'use strict';
var Transform = require('stream').Transform
  , Chainable = require('simple-chainable')
  , _defaults = require('lodash.defaults')
  , binary = require('./lib/binaryHelpers')
  , util = require('util')
  , debug = require('debuglog')('tokenstream')
  ;

var types = {
    UInt8:    1,
    Int8:     1,
    UInt16LE: 2, 
    UInt16BE: 2,
    Int16LE:  2,
    Int16BE:  2,
    UInt32LE: 4, 
    UInt32BE: 4,
    Int32LE:  4,
    Int32BE:  4,   
    DoubleLE: 8,
    DoubleBE: 8
}

module.exports = StreamTokenizer

util.inherits(StreamTokenizer, Transform)

var defaults = {
        strictEnd: false, //require bytes read to match
        noAssert: false,
        drainAllOnEnd: false, // push all data left in the buffer on end
        error: function(str){
            this.push(null)

            return this.emit('error', new Error(str))
        }
    }
function StreamTokenizer(opts){
    if ( !(this instanceof StreamTokenizer) ) 
        return new StreamTokenizer(opts)

    Transform.call(this, opts)

    this.chainable = new Chainable()

    this.options = _defaults(opts, defaults)

    this.bytesRead = 0
    this.waiting = []
    this.tokens  = {}
    this._data = []
    this._len = []
}


StreamTokenizer.prototype._transform = function(chunk, enc, done) {
    this._data.push(chunk)
    this._len += chunk.length
    this.chainable.next()
    done()
};

StreamTokenizer.prototype._flush = function(done) {
    var self = this;

    self._flushed = true;

    self.tap(function(){
        self.options.drainAllOnEnd && self.push(self.parse());
        done()
    })

    self.chainable.next()
};


// if is essentially the fromList function in readable stream, the complex case borrows almost entirelly 
// Copyright Joyent, Inc. and other Node contributors.
StreamTokenizer.prototype.parse = function(size) {
    var length = this._len
      , data = this._data
      , bytes;

    if (data.length === 0 || length === 0 || size > length) //nothing in buffer
        bytes = null; 

    else if ( size === data[0].length ) //perfect match
        bytes = data.shift() 

    else if ( size < data[0].length ) {
        bytes         = data[0].slice(0, size)
        this._data[0] = data[0].slice(size) 

    } else if ( size == null) {
        bytes = Buffer.concat(data, length) 
        data.length = 0; // clear array

    } else {
        var c = 0;

        bytes = new Buffer(size);

        for (var i = 0, l = data.length; i < l && c < size; i++) {
            var buf = data[0]
              , cpy = Math.min(size - c, buf.length);

            buf.copy(bytes, c, 0, cpy)

            if (cpy < buf.length)
                data[0] = buf.slice(cpy)
            else
                data.shift()

            c += cpy
        }
    }

    if ( bytes !== null ) {
        this.bytesRead += bytes.length
        this._len -= bytes.length
    }

    return bytes
};

StreamTokenizer.prototype._callOrStore = function(cb, val) {
    if ( typeof cb === 'function') cb( val, this.tokens)
    else this.tokens[cb] = val  
};

StreamTokenizer.prototype.flush = function() {
    var self = this;

    self.chainable.add(function(){
        self.tokens = {}
        self.chainable.next()
    })
    return self
};

StreamTokenizer.prototype._getAtLeast = function(bytes, cb) {
    var self = this;

    self._getBytes('', null, function(buf){
        var len = buf.length;

        if ( self._last ){
            len += self._last.length
            buf = Buffer.concat( [self._last, buf], len)
        }

        if ( len < bytes ) {
            self._last = buf
            self.chainable.addBack()
            return
        } 

        cb( buf )
        self._last = null
    })    
};

StreamTokenizer.prototype._getBytes = function(type, bytes, cb) {
    var self = this
      , buf;

    if ( typeof bytes === 'string' && this.tokens[bytes] !== undefined)
        bytes = this.tokens[bytes]

    buf = bytes === null
        ? self.parse()
        : self.parse(bytes)

    if ( buf === null ){
        if ( self._flushed )
            if ( !self.options.noAssert ) this.emit('error',
                new Error('Not enough data left in the stream to read: ' + (type || (bytes + ' byte buffer'))))
            else
                cb.call(self, null)
        else
            self.chainable.addBack()
    } else {
        if ( type ) 
            buf = buf['read' + type](0)

        if ( cb )
            cb.call(self, buf)
    }   
};

StreamTokenizer.prototype.readBuffer = function(size, cb) {
    var self = this;

    self.chainable.add(function(){

        self._getBytes('', size, function(b){
            self._callOrStore(cb, b)
            self.chainable.next()
        }) 
    })

    return self
};

StreamTokenizer.prototype.tap = function(cb) {
    var self = this;

    self.chainable.nest(function(){
       cb.call(self, self.tokens)
    });
    return self
};

StreamTokenizer.prototype.loop = function (cb) {
    var self = this
      , end = false;

    function done() {
        end = true
        self.chainable.next()
    }

    function loop () {
        self.tap(cb.bind(self, done, self.tokens ))
        self.tap(function () {
            if ( !end ) loop.call(self)
            else self.chainable.next()
        });
        
    }

    self.chainable.nest( loop );
    return self;
};

StreamTokenizer.prototype.isEqual = function(buf, msg){
    var self = this
      , error = typeof msg === 'function'
        ? msg 
        : this.options.error;

    return this.readBuffer(buf.length, function(b){
        if ( !binary.bufferEqual(b, buf)  )
           error.call(self, msg)
    })
};

StreamTokenizer.prototype.skip = function(size){
    var self = this;

    this.chainable.add(this._getBytes.bind(this),'', size, function(){
        self.chainable.next()
    })
    return this
}

StreamTokenizer.prototype.skipUntil = function(chunk, iter, thisArg){
    var self = this
      , getAtLeast = self._getAtLeast.bind(self)
      , buf;

    thisArg = thisArg || null;

    if ( Buffer.isBuffer(chunk)){
        buf = chunk;
        thisArg = iter;
        iter = getBufferIter(buf);
    } else {
        chunk = chunk || 1;    
    }

    self.chainable.add(getAtLeast, chunk, function(buf){
        var val
          , i = 0 
          , len = buf.length;
            
        for(; i < len; i++){
            val = iter.call(thisArg, chunk === 1 ? buf[i] : buf.slice(i, i + chunk));
            if ( val ) {
                self.bytesRead -= buf.length - i
                self._data.unshift(buf.slice(i))
                break    
            }
        }
        self.chainable.next()
    });

    return this
}

StreamTokenizer.prototype.readString = function(size, enc, cb) {
    var self = this;

    self.chainable.add(function(){
        if ( typeof size === 'string' && self.tokens[size] !== undefined)
            size = self.tokens[size]

        if ( !size ) return self.chainable.next()

        self._getBytes('', size, function(b){
            var str = binary.decodeString(b, enc)

            self._callOrStore(cb, str)
            self.chainable.next()
        }) 
    })
    return self;
}

Object.keys(types).forEach(function(type){

    StreamTokenizer.prototype['read' + type] = function(cb){
        var self = this
            , getBytes = self._getBytes.bind(self);

        self.chainable.add(getBytes, type, types[type], function(buf){
            self._callOrStore(cb, buf)
            self.chainable.next()
        });

        return self
    }
})

function getBufferIter(buff) {
    return function(chunk){
        for (var i = 0; i < chunk.length; i++) {
            if (buff[i] !== chunk[i]) 
                return false;
        }
    }    
}