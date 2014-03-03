var chai = require('chai')
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , Assertion = require("chai").Assertion
  , Tokenizer = require('../stream-tokenizr')
  , Readable  = require('stream').Readable
  , bufferEqual = require('../lib/binaryHelpers' ).bufferEqual;

chai.use(sinonChai);
chai.should();

Assertion.addMethod("buffer", function(buffer, enc){
    var obj = this._obj

    buffer = typeof buffer === 'string'
        ? new Buffer(buffer, enc)
        : buffer

    this.assert(
        bufferEqual(obj, buffer)
        , "expected buffer #{exp} to equal #{act}"
        , "expected buffer #{exp} not to equal #{act}"
        , obj
        , buffer)
})

describe('when data is written to the tokenzr', function(){
    var src, toknzr, options;

    beforeEach(function(){
        options = {};
        src = new Readable();
        toknzr = new Tokenizer(options)
    })

    it ('should read the data', function(done){

        writeAsync(toknzr, [ 'hello' ])
            .readBuffer(4, 'test')
            .tap(function(vars){
                vars.should.have.property('test').that.is.a.buffer('hell', 'utf8')
                done()
            })
    })

    describe( 'when the chunk requested is larger then a single read chunk', function(){

        it('should wait until the data is parsed before returning', function(done){

            writeAsync(toknzr, [ 'read ', 'me', 'all the way' ])
                .readBuffer(7, 'test')
                .tap(function(vars){
                    vars.should.have.property('test').that.is.a.buffer('read me', 'utf8')
                    done()
                })
        })

    })

    describe( 'when the chunk requested cannot be satisfied', function(){

        it('should throw an error if noAssert is false', function(done){

            writeAsync(toknzr, [ 'read' ])
                .readBuffer(7, 'test')

            toknzr.on('error', function(err){
                err.should.be.an.instanceOf( Error )
                err.message.should.contain('Not enough data left in the stream to read')
                done()
            })
        })

        it('should end quietly if noAssert is set', function(done){
            toknzr.options.noAssert = true;

            writeAsync(toknzr, [ 'read' ])
                .readBuffer(7, 'test')

            toknzr.on('error', function(err){
                throw err
            })
            toknzr.on('finish', function(err){
                done()
            })
        })

        it('should drain the remaining data if drainOnEnd is et', function(done){
            toknzr.options.noAssert = true;
            toknzr.options.drainAllOnEnd = true;

            writeAsync(toknzr, [ 'read' ])
                .readBuffer(5, 'test')

            toknzr.on('error', function(err){ throw err})

            toknzr.on('data', function(data){
                data.should.be.a.buffer('read', 'utf8')
                done()
            })
        })
    })
})


function writeAsync(stream, data){
    function doToimeout(data, ms, end){
        setTimeout(function(){
            stream[end ? 'end' : 'write'](data)
        }, ms)
    }

    for( var i =0; i < data.length; i++){
        doToimeout(new Buffer(data[i], 'utf8'), 100 * i, i === (data.length - 1) );
    }

    return stream;
}