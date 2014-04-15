'use strict';
var Transform = require('readable-stream').Transform
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

    this.options = _defaults(opts || {}, defaults)

    this.bytesRead = 0
    this.waiting = []
    this.tokens  = {}
    this._data = []
    this._len = []
    this._needsStart = true;
}


StreamTokenizer.prototype._transform = function(chunk, enc, done) {
    this._data.push(chunk)
    this._len += chunk.length

    if ( this._needsStart ) {
        this._needsStart = false
        this.chainable.next()
    }

    done()
};

StreamTokenizer.prototype._flush = function(done) {
    var self = this;

    self._flushed = true;

    self.tap(function(){
        self.options.drainAllOnEnd && self.push(self.parse());
        done()
    })

    if ( self._needsStart )
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

    else if ( size == null) {
        bytes = Buffer.concat( data, length )
        data.length = 0; // clear array
    }
    else if ( size < data[0].length ) {
        bytes         = data[0].slice(0, size)
        this._data[0] = data[0].slice(size)

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


StreamTokenizer.prototype._getBytes = function(type, bytes, cb) {
    var self = this
      , buf;

    if ( typeof bytes === 'string' && this.tokens[bytes] !== undefined)
        bytes = this.tokens[bytes]

    buf = self.parse(bytes)

    if ( buf === null ){
        if ( self._flushed )
            if ( !self.options.noAssert ) this.emit('error',
                new Error('Not enough data left in the stream to read: ' + (type || (bytes + ' byte buffer'))))
            else
                cb.call(self, null)
        else {
            self._needsStart = true;
            self.chainable.addBack()
        }
    } else {
        if ( type ) 
            buf = buf['read' + type](0)

        if ( cb )
            cb.call(self, buf)
    }   
};

StreamTokenizer.prototype.addBack = function(data) {
    this._data.unshift(data)
    this._len += data.length
}

StreamTokenizer.prototype.readBuffer = function(size, cb) {
    var self = this;

    if (typeof size === 'function'){
        cb = size
        size = null
    }

    self.chainable.add(function(){

        self._getBytes('', size, function(b){
            self._callOrStore(cb, b)
            self.chainable.next()
        }) 
    })

    return self
};

StreamTokenizer.prototype.peek = function(bytes, cb) {
    var self = this;

    self.readBuffer(bytes, function(buffer){
        self.addBack(buffer)
        cb.call(self, buffer, self.tokens)
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
        self.tap(function(){
                cb.call(self, done, self.tokens )
            })
            .tap(function () {
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

StreamTokenizer.prototype.skipUntil = function(size, iterator, thisArg){
    var self = this
      , leftover, result, token;

    if (Buffer.isBuffer(size)){
        thisArg = iterator
        token = size
        iterator = function(b){
            return binary.bufferEqual( b.slice(0, size), token)
        }
        size = size.length
    }

    thisArg = thisArg || null;

    return self.loop(function(done){

        self.readBuffer(function(chunk){
            var i = 0, len;

            if (chunk === null ) return done()

            if ( leftover )
                chunk = Buffer.concat([ leftover, chunk ], leftover.length + chunk.length)

            len = chunk.length

            for(; (i + size) <= len; i++){
                result = iterator.call(thisArg, chunk.slice(i))

                if ( result ) {
                    self.bytesRead -= len - i
                    self.addBack(chunk.slice(i))
                    return done()
                }
            }

            leftover = (i + size) > len
                ? chunk.slice(i)
                : null;
        })
    })
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

