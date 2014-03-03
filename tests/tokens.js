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
  
describe('when a token is requested ', function(){
    var src, toknzr, options;

    beforeEach(function(){
        options = {};
        src = new Readable();
        toknzr = new Tokenizer(options)
    })

    describe('when a buffer is requested ', function(){

        it ('should return the correct buffer', function(done){

            writeAsync(toknzr, [ 'hello' ])
                .readBuffer(4, 'test')
                .tap(function(vars){
                    vars.test.should.be.a.buffer('hell', 'utf8')
                    done()
                })
        })
    })

    describe('when strings are requested ', function(){
        it('should return the correct strings', function(done){
            toknzr.tokens.finalLen = 1;

            toknzr
                .readString(5, 'utf8', 'v1')
                .skip(1)
                .readString(5, 'utf8', function(str){
                    toknzr.tokens.v2 = str
                })
                .readString('finalLen', 'utf8', 'v3')
                .tap(function(vars){
                    vars.v1.should.equal('hello')
                    vars.v2.should.equal('world')
                    vars.v3.should.equal('!')
                    done()
                })

            toknzr.write(new Buffer('hello world!', 'utf8'))
        })
    })

    describe('when integers are requested ', function(){

        it ('should return the correct integers', function(done){

            toknzr
                .readInt8('8Int')
                .readUInt8('8UInt')
                .readInt16LE( '16IntLE')
                .readUInt16LE('16UIntLE')
                .readInt16BE( '16IntBE')
                .readUInt16BE('16UIntBE')
                .readInt32LE( '32IntLE')
                .readUInt32LE('32UIntLE')
                .readInt32BE( '32IntBE')
                .readUInt32BE('32UIntBE')
                .tap(function(vars){
                    vars['8Int'].should.equal(-10)
                    vars['8UInt'].should.equal(10)

                    vars['16IntLE'].should.equal(-20)
                    vars['16UIntLE'].should.equal(20)
                    vars['16IntBE'].should.equal(-5120)
                    vars['16UIntBE'].should.equal(5120)

                    vars['32IntLE'].should.equal(-30)
                    vars['32UIntLE'].should.equal(30)
                    vars['32IntBE'].should.equal(-503316480)
                    vars['32UIntBE'].should.equal(503316480)
                    done()
                })

            toknzr.write(new Buffer([
                -10,   10,
                -20, -1,   20, 0,   -20, 0,   20, 0,
                -30, -1, -1, -1,   30, 0, 0, 0,   -30, 0, 0, 0,    30, 0, 0, 0]))
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