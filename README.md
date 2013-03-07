munj - streaming data munging using javascript generators
---------------------------------------------------------

The command line has always used ad-hoc iteration protocols.  How many
times have you done something like

    for x in *; do du -s $x; done

only to realize that you have a directory name with a space in it?  Then you
have to do something much more cumbersome, e.g.:

    find -mindepth 1 -maxdepth 1 -print0 | xargs -0 du -s


Or have you ever tried to process a tab-delimited file, only to find
that one of the columns can contain tab characters?

The problem is that item boundaries are signaled in-band, often
without escaping.  The solution is to use a generic syntax with proper
escaping rules.  Like JSON, for example.  Or to use an out-of-band
iteration protocol, like javascript iterators/generators.  Javascript
is also the natural way to process JSON.  munj is a prototype for
using javascript iterators/generators to do command-line data munging.

Examples
--------

    $ ./munj 'lines("test/delim.txt")'
    [
      "a	b	1	c	d	x",
      "a2	b2	2	c2	d2	x2",
      "	b3	3	c3	d3	x3"
    ]
    
    $ ./munj 'sum(l.length for (l in lines("test/delim.txt")))'
    41
    
    $ ./munj 'ila("test/delim.txt")'
    [
      ["a","b","1","c","d","x"],
      ["a2","b2","2","c2","d2","x2"],
      ["","b3","3","c3","d3","x3"]
    ]
    
    $ ./munj '(l[1] for (l in ila("test/delim.txt")))'
    [
      "b",
      "b2",
      "b3"
    ]
    
    $ ./munj 'lines("https://raw.github.com/skinner/munj/master/test/delim.txt")'
    [
      "a	b	1	c	d	x",
      "a2	b2	2	c2	d2	x2",
      "	b3	3	c3	d3	x3"
    ]
    
    $ ./munj '(l for (l in lines("test/delim.txt")) if (l.match(/b\d/)))'
    [
      "a2	b2	2	c2	d2	x2",
      "	b3	3	c3	d3	x3"
    ]
    
    $ ./munj 'interleave(lines("test/delim.txt"), lines("test/delim.txt"))'
    [
      "a	b	1	c	d	x",
      "a	b	1	c	d	x",
      "a2	b2	2	c2	d2	x2",
      "a2	b2	2	c2	d2	x2",
      "	b3	3	c3	d3	x3",
      "	b3	3	c3	d3	x3"
    ]
    
    $ ./munj 'range(1, 6)'
    [
      1,
      2,
      3,
      4,
      5
    ]
    
    $ ./munj 'zip(range(0, 2), range(5, 8), range(10, 14))'
    [
      [0,5,10],
      [1,6,11],
      [null,7,12],
      [null,null,13]
    ]
    
    $ ./munj 'concat(range(1, 3), range(6, 8))'
    [
      1,
      2,
      6,
      7
    ]
    
    $ ./munj "sample(5, range(0, 100000))"
    [
      98677,
      6027,
      91333,
      25585,
      35203
    ]
    
    $ ./munj 'filter(function(x){return 0 == x % 2;}, range(1, 10))'
    [
      2,
      4,
      6,
      8
    ]
    
    $ ./munj 'ls()'
    [
      "test",
      "munj.js",
      ".git",
      "munj",
      ".gitignore",
      "README"
    ]
    
    $ ./munj 'take(3, range(1, 6))'
    [
      1,
      2,
      3
    ]
    
    $ ./munj 'drop(2, range(1, 6))'
    [
      3,
      4,
      5
    ]
    
    $ ./munj 'tail(2, range(1, 6))'
    [
      4,
      5
    ]
    
    $ ./munj 'sum(range(1, 6))'
    15
    
    $ ./munj 'product(range(1, 6))'
    120
    
    $ ./munj 'reduce(function(x, y) {return x + "-" + y}, "", range(1, 6))'
    "-1-2-3-4-5"
    
    $ ./munj 'values([4, 8, 15, 16, 23, 42])'
    [
      4,
      8,
      15,
      16,
      23,
      42
    ]
    