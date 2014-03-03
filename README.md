Stream Tokenizr
================

Easily parse binary data with a convenient accessible fluent interface, and node streams. Tokenzr is a small Transform
stream implementation, that pulls binary data in and pushes out whatever tokens you wish.

    var Tokenizr = require('stream-tokenizr')
      , stream = getAReadStream();

    var tokenizr = stream.pipe(new Tokenizr({ objectMode: true }));

    tokenizr
        .readString(5, 'uft8', 'myString')
        .readUInt16LE('myInt')
        .tap(function(state){
            this.push(state.myString)
            this.push(state.myInt)
        })

You can also just inherit stream tokenizr to help create complex stream parsers (such as metadata parser for audio files)
