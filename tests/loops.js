var chai = require('chai')
  , sinon = require('sinon')
  , sinonChai = require('sinon-chai')
  , Tokenizer = require('../stream-tokenizr')
  , bufferEqual = require('../lib/binaryHelpers' ).bufferEqual;

chai.use(sinonChai)
chai.should()


describe('when looping', function(){
    var toknzr;

    beforeEach(function(){
        toknzr = new Tokenizer({ noAssert: true })
    })


    it('should loop only the expected times', function(done){
        var i = 0, looper = sinon.spy(function(end){
            if (++i === 5) end()
        })

        toknzr
            .loop(looper)
            .tap(function(){
                looper.callCount.should.equal(5)
                done()
            })
            .end()
    })


    it('should sleep when expected', function(done){
        var looper = sinon.spy(function (end) {
            this.readString(5, 'utf8', function(str){
                if ( !str ) return end()
            })
        })

        writeAsync(toknzr, ['hello', 'world!!'])
            .loop(looper)
            .tap(function(){
                looper.should.have.been.calledThrice
                done()
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