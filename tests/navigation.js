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

describe('when a one wishes to move through the buffer ', function(){
    var src, toknzr, options;

    beforeEach(function(){
        options = { noAssert: true};
        src = new Readable();
        toknzr = new Tokenizer(options)
    })

    describe('when skipping', function(){

        it ('should skip the correct number of bytes', function(done){

            toknzr
                .skip(6)
                .readBuffer(6, 'word')
                .tap(function(vars){
                    vars.word.should.be.a.buffer('world!', 'utf8')
                    done()
                })

            toknzr.write(new Buffer('hello world!', 'utf8'))
        })
    })

    describe('when scanning', function(){

        it('should only read up to the token', function(done){

            writeAsync(toknzr, [ 'hello ', 'world! here comes', 'a new one' ])
                .skipUntil(new Buffer('here'))
                .readString(4, 'utf8', 'first')
                .skipUntil(5, strEqual)
                .readString(5, 'utf8', 'second')
                .tap(function(tokens){
                    tokens.first.should.equal('here')
                    tokens.second.should.equal('comes')
                    this.bytesRead.should.equal(23)
                    done()
                })

            function strEqual(buffer){
                return buffer.toString('utf8', 0, 5 ) === 'comes'
            }
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