Stream Tokenizr
================

Easily parse binary data with a convenient accessible fluent interface, and node streams. Tokenzr is a small Transform
stream implementation, that pulls binary data in and pushes out whatever tokens you wish.

Tokenizr more or less implements the same API as Substack's Binary  where it made sense, although the internals or simplier and (i think)
more straight forward, by making use of the newer streams api. Each tokenizr is a Transform stream instance so check
[here](http://nodejs.org/api/stream.html#stream_class_stream_transform) for that api. The ultimate form and content of the
parsed data is up to you.

### Using the Tokenizr
    var Tokenizr = require('stream-tokenizr')
      , stream = getAReadStream();

    var tokenizr = stream.pipe(new Tokenizr({ objectMode: true }));

    tokenizr
        .readString(5, 'uft8', 'myString')
        .readUInt16LE('myInt')
        .tap(function(state){
            var obj = {
                'message': state.myString,
                'number': state.myInt
            }
            // we can now push the parsed data out to the world
            // see: http://nodejs.org/api/stream.html#stream_readable_push_chunk_encoding
            this.push(obj)
        })

    tokenizr.on('data', function(obj){
        console.log('obj')
    })

### Building parser streams
You can also inherit stream Tokenizr to help create complex stream parsers. Take a look at the various audio file
parsers i've written for some [real](https://github.com/theporchrat/asf-info-parser) [world](https://github.com/theporchrat/mp4-info-parser)
[examples](https://github.com/theporchrat/ogg-info-parser)

#### parser.js
Here we create a new `Parser` Stream that inherits from Tokenizr

    var Tokenizr = require('stream-tokenizr');

    module.exports = Parser

    require('util').inherits(Parser, Tokenizr);

    function Parser(opts){
        Tokenizr.call(this, opts)

        this
            .readString(5, 'uft8', 'myString')
            .readUInt16LE('myInt')
            .tap(function(state){
                 var obj = {
                     'message': state.myString,
                     'number': state.myInt
                 }
                 // we can now push the parsed data out to the world
                 // see: http://nodejs.org/api/stream.html#stream_readable_push_chunk_encoding
                 this.push(obj)
                 this.push(null)
            })
    }

#### main.js

    var Parser = require('./parser')
      , source = getAReadStream();

    var parser = new Parser();

    source
        .pipe(parser)
        .on('data', function(obj){ // you can also use the new read()
            console.log(obj) // => { message: 'hello', myInt: 5 }
        })


## API

### .readBuffer(Int bytes, Function|String callback)

reads a buffer of a specified size in bytes.

1. if you provide a `Function` for the callback it will be called with the buffer as the first argument,
   and the `state` object as the second.
2. Providing a `String` as the callback will assign the buffer in the `state` object under a key of that name


    tokenizr
        .readBuffer(4, 'first')
        .readBuffer(5, function(buffer, state){
            buffer.length // 5
            state.first.length // 4
        })