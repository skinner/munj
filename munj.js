let Cc = Components.classes;
let Ci = Components.interfaces;

let dirService = Cc["@mozilla.org/file/directory_service;1"]
    .getService(Ci.nsIDirectoryServiceProvider);
let ioService = Cc["@mozilla.org/network/io-service;1"]
    .getService(Ci.nsIIOService);

/**
 * read the given file/path line by line
 * @param toRead a url/path string or an nsIFile
 * @param charSet optional parameter giving the character set for the file
 *                 (defaults to UTF-8)
 * @return an iterator over the lines in the file
 */
function lines(toRead, charSet) {
    var convStream;
    try {
        convStream = _cstreamFrom(toRead, charSet);
        convStream.QueryInterface(Ci.nsIUnicharLineInputStream);

        if (convStream instanceof Ci.nsIUnicharLineInputStream) {
            var line = {};
            var cont;
            do {
                cont = convStream.readLine(line);
                yield line.value;
            } while (cont);
        }
    } finally {
        if (convStream) convStream.close();
    }
}

function getString(toRead, charSet) {
    var data = "";
    var convStream;
    try {
        convStream = _cstreamFrom(toRead, charSet);

        let (str = {}) {
            let read = 0;
            do {
                 // read as much as we can and put it in str.value
                read = convStream.readString(0xffffffff, str);
                data += str.value;
            } while (read != 0);
        }

    } finally {
        if (convStream) convStream.close();
    }

    return data;
}

function _cstreamFrom(toRead, charSet) {
    if ('undefined' == typeof charSet) charSet = "UTF-8";

    let convStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
        .createInstance(Ci.nsIConverterInputStream);

    let url;
    if ("string" == typeof toRead) {
        url = _resolve(toRead);
    } else if (toRead instanceof Ci.nsIFile) {
        url = ioService.newFileURI(toRead);
    } else {
        throw new Error("couldn't handle input source: " + toRead);
    }

    //TODO figure out how to get stdin
    let channel, input;
    try {
        channel = ioService.newChannelFromURI(url);
        input = channel.open();
    } catch (e) {
        throw new Error("unable to open url: " + url.spec);
    }
    //when could we use this?
    //print(input.contentCharset);

    convStream.init(input, charSet, 1024, 0xFFFD);
    return convStream;
}

function getJson(toRead) {
    return JSON.parse(getString(toRead, "UTF-8"));
}

/**
 * list the files/directories for the given path
 * @param path path string
 * @return iterator over nsIFile objects
 */
function ls(path) {
    return _ls(path, false);
}

/**
 * recursively list the files/directories for the given path
 * @param path path string
 * @return iterator over nsIFile objects
 */
function lsr(path) {
    return _ls(path, true);
}

function _ls(path, recurse) {
    if ("undefined" == typeof path) path = ".";
    let uri = _resolve(path);
    let f = uri.QueryInterface(Ci.nsIFileURL).file;
    if (f.isDirectory()) {
        for each (subEntry in _lsdir(f, recurse)) {
             yield subEntry;
        }
    } else {
        yield f;
    }
}

function _lsdir(dir, recurse) {
    let entries = dir.directoryEntries;
    while (entries.hasMoreElements()) {
        let entry = entries.getNext();
        entry.QueryInterface(Ci.nsIFile);
        yield entry;
        if (recurse && entry.isDirectory()) {
            yield _lsdir(entry, recurse);
        }
    }
}    

/** our custom path/url resolution function which resolves relative to
 *  the current working directory, and does tilde expansion
 */
function _resolve(path) {
    path = _expandTilde(path);

    let cwd = dirService.getFile("CurWorkD", {});
    let cwdUri = ioService.newFileURI(cwd);
    return ioService.newURI(path, null, cwdUri);
}

function _expandTilde(url) {
    //I don't think we have a platform-independent way to get other users'
    //home directories, so for now we just hack ~ for the current user's
    //home dir.
    let homeDir = ioService.newFileURI(dirService.getFile("Home", {}));
    return url.replace(/^\s*~/, homeDir.spec);
}

/**
 * short for "input lines->arrays"; iterates over the lines of the input,
 * splitting each line into an array by the given separator
 * @param url url/path string for the input to read
 * @param sep string or regex separator to use to split the input lines
 * @param charSet optional parameter identifying the input character set
 * @return an iterator that gives an array for each line in the input file
 */
function ila(url, sep, charSet) {
    if ("undefined" == typeof sep) sep = "\t";
    for (let line of lines(url, charSet)) {
        yield line.split(sep);
    }
}

/**
 * short for "output arrays->lines"; given an iterator over arrays, returns
 * an iterator.  for each input array, yields a string of the array
 * joined by the given separator
 * @param iterator iterator yielding arrays (if it's not an array, this
 *                 function just yields it untouched)
 * @param sep string to use to join the input arrays
 * @return iterator yielding a string for each array from the input iterator
 */
function oal(sep, iter) {
    if ("undefined" == typeof sep) sep = "\t";
    for (let arr of iter) {
        if (arr instanceof Array)
            yield (arr.join(sep));
        else
            yield arr;
    }
}

/**
 * iterates over a numeric range; iteration is finite if:
 *     (start < end) && (step > 0)
 *     or
 *     (start > end) && (step < 0)
 * otherwise, iterates until hitting some kind of numeric representation limit,
 * I imagine.  Or possibly forever.
 * The iterator returned by this function will not include the end number
 * (i.e., the range is half-open).
 * @param start starting number for the range
 * @param end ending number for the range (the iteration will stop just before
 *            returning this number)
 * @param step optional parameter giving the size of each step in the iteration
 * @return iterator over numbers in the range
 */
function range(start, end, step) {
    if ("undefined" == typeof step) step = 1;
    if (end >= start) {
        for (let i = start; i < end; i += step)
            yield i;
    } else {
        for (let i = start; i > end; i += step)
            yield i;
    }
}

/**
 * iterate over the first num items from the given iterator
 * @param num number of items to take
 * @param iter source iterator for items
 * @return iterator yielding the first num items from iter
 */
function take(num, iter) {
    while (num > 0) {
        yield iter.next();
        num--;
    }
}

/**
 * iterate over the items from the given iterator as long as pred is truthy
 * @param pred function that returns false to stop iterating, and true otherwise
 * @param iter source iterator
 * @return iterator that yields items from iter until pred is falsy for an item
 */
function takeWhile(pred, iter) {
    while (true) {
        var item = iter.next();
        if (! pred(item)) throw StopIteration;
        yield item
    }
}

/**
 * drop the first num items from iter
 * @param num number of items to drop
 * @param iter source iterator for items
 * @return iterator after num items have been dropped from it
 */
function drop(num, iter) {
    try {
        while (num > 0) {
            iter.next();
            num--;
        }
    } catch (e if e instanceof StopIteration) {
    }
    return iter;
}

/**
 * iterate over the last num items from iter
 * @param num number of items to yield
 * @param iter source of items
 * @return an iterator that yields the last num items from iter
 */
function tail(num, iter) {
    let result = new Array(num);
    let count = 0;
    for (let elem of iter) {
        result[count % num] = elem;
        count++;
    }
    for (let i = Math.max(0, count - num); i < count; i++) {
        yield result[i % num];
    }
}

/**
 * filter a given iterator for items matching a condition
 * (there is already syntax for this in generator expressions; this function
 *  exists in case this form is more convenient)
 * @param pred function that returns true for items that should pass the filter
 * @param iter source iterator
 * @return an iterator over the items that passed the filter
 */
function filter(pred, iter) {
    return (x for (x of iter) if (pred(x)));
}

/**
 * take a random sample of num items, without replacement, from the given
 * iterator.
 * (uses the reservoir sampling method named "algorithm R" in the vitter paper)
 * @param num sample size
 * @param iter source of items
 * @return an iterator that yields the sampled items
 */
function sample(num, iter) {
    let reservoir = [];
    try {
        for (let i = 0; i < num; i++)
            reservoir.push(iter.next());

        let t = num;

        for (let elem of iter) {
            t += 1;
            // m = random number on [0, t]
            let m = Math.floor((t + 1) * Math.random()) | 0;
            if (m < num) reservoir[m] = elem;
        }                
    } catch (e if e instanceof StopIteration) {
    }
    return values(reservoir);
}

/**
 * give the number of items in an iterator
 * @param iter source of items
 * @return the number of items yielded by iter
 */
function length(iter) {
    let result = 0;
    try {
        while(iter.next()) {
            result++;
        }
    } catch (e if e instanceof StopIteration) {
    }
    return result;
}

/**
 * repeat the given value the n times, or forever if n is omitted
 * @param value the value to repeat
 * @param n the number of times to repeat the value (if omitted, will repeat
 *        forever)
 * @return iterator that yields the value repeatedly
 */
function repeat(value, n) {
    if (n === undefined) n = -1;
    for (var i = 0; i < n; i++) {
        yield value;
    }
}
/**
 * concatenate multiple iterators
 * @param one or more iterators
 * @return iterator that returns the items from the given iterators, 
 *         going through all the elements of the first argument, then
 *         all the elements of the second, and so on
 */
function concat() {
    for (var i = 0; i < arguments.length; i++) {
        for (let item of arguments[i]) {
            yield item;
        }
    }
}

/**
 * interleave values from multiple iterators
 * @param one or more iterators
 * @return iterator that returns the first item from the first argument, then
 *         the first item from the second argument, and so on for each argument,
 *         then the second item from the first argument, etc.
 */
function interleave() {
    var args = Array.prototype.slice.call(arguments, 0);
    while (true) {
        for (var i = 0; i < args.length; i++) {
            try {
                yield args[i].next();
            } catch (e if e instanceof StopIteration) {
                // this is fiddly, but is there a better way?
                args.splice(i, 1);
                if (0 == args.length) throw StopIteration;
                i -= 1;
            }
        }
    }
}

/**
 * zip together items from the multiple generators
 * @param one or more iterators
 * @return iterator that generates arrays; the length of each array is the
 *         number of arguments to zip; each array contains one element
 *         from each of the given iterators, or null if one or more
 *         of the given iterators has stopped
 */
function zip() {
    var args = Array.prototype.slice.call(arguments, 0);
    var liveIters = args.length;
    var item;
    while (true) {
        item = new Array(args.length);
        for (var i = 0; i < args.length; i++) {
            if (args[i] == null) continue;
            try {
                item[i] = args[i].next()
            } catch (e if e instanceof StopIteration) {
                args[i] = null;
                liveIters--;
                if (0 == liveIters) throw StopIteration;
            }
        }
        yield item;
    }
}

/**
 * zip together items from the multiple generators, using the given function
 * @param a function that takes as many arguments as there are given iterators
 * @param one or more iterators
 * @return iterator that returns the results of calling the given function
 *         on the values from the given iterators
 */
function zipWith() {
    var args = Array.prototype.slice.call(arguments, 0);
    var fun = args.shift();
    var liveIters = args.length;
    var item;
    while (true) {
        items = new Array(args.length);
        for (var i = 0; i < args.length; i++) {
            if (args[i] == null) continue;
            try {
                items[i] = args[i].next()
            } catch (e if e instanceof StopIteration) {
                args[i] = null;
                liveIters--;
                if (0 == liveIters) throw StopIteration;
            }
        }
        // don't know what a useful "thisArg" might be here
        yield fun.apply(items, items);
    }
}

/**
 * flatten any nesting from an iterator
 * @param iter an iterator, the items from which may themselves be iterators
 * @return an iterator over items from the given iterator, which recursively
 *         yields items from any nested iterator.  Items from the returned
 *         iterator will not themselves be iterators.
 */
function flatten(iter) {
    for (let item of iter) {
        if (isIter(item)) {
            for (let subItem of flatten(item)) {
                yield subItem
            }
        } else {
            yield item;
        }
    }
}

/**
 * map a function over the items from an iterator
 * @param fun function to apply to the items
 * @param iter the source iterator
 * @return an iterator over the results from the function
 */
function map(fun, iter) {
    for (let elem of iter) {
        yield fun(elem);
    }
}

/**
 * group values from the given iterator, reducing each group with the reduceFn
 * @param groupFn takes a value from the iterator, and returns the group
 *                that the value belongs to
 * @param reduceFn successively reduces elements in a group to produce a result
 * @param reduceInit starting value for the reduce function
 * @param iter source of items
 * @return object where the keys are the group identifiers and the values
 *         are the results of the groupFn for each group
 */
function groupReduce(groupFn, reduceFn, reduceInit, iter) {
    let result = {};
    // stringifying and parsing reduceInit to make a fresh deep copy of
    // reduceInit for each group
    let initString = JSON.stringify(reduceInit)
    for (let elem of iter) {
        let group = groupFn(elem);
        if (! (group in result)) result[group] = JSON.parse(initString);
        result[group] = reduceFn(result[group], elem);
    }
    return result;
}

/**
 * reduce an iterator with a function
 * @param iter source of items
 * @param fun reduce function, which should take two arguments
 * @param init starting value for the reduction
 * @return final result of the reduction
 */
function reduce(fun, init, iter) {
    let result = init;
    for (let elem of iter) {
        result = fun(result, elem);
    }
    return result;
}

/**
 * add up all the numbers yielded by the given iterator
 * @param iter iterator yielding numbers
 */
function sum(iter) {
    let result = 0;
    for (let elem of iter) {
        result += parseFloat(elem);
    }
    return result;
}

/**
 * give the product of all the numbers yielded by the given iterator
 * @param iter iterator yielding numbers
 */
function product(iter) {
    let result = 1;
    for (let elem of iter) {
        result *= parseFloat(elem);
    }
    return result;
}

/**
 * give the maximum number of all the numbers yielded by the given iterator
 * @param iter iterator yielding numbers
 */
function max(iter) {
    let result = iter.next();
    for (let elem of iter) {
        result = Math.max(result, elem);
    }
    return result;
}

/**
 * give the minimum number of all the numbers yielded by the given iterator
 * @param iter iterator yielding numbers
 */
function min(iter) {
    let result = iter.next();
    for (let elem of iter) {
        result = Math.min(result, elem);
    }
    return result;
}

/**
 * yield all the (own) keys from the given object
 * @param obj object with keys to iterate over
 */
function keys(obj) {
    for (let x in obj) {
        if (obj.hasOwnProperty(x))
            yield x;
    }
}

/**
 * yield all the (own) values from the given object
 * @param obj object with values to iterate over
 */
function values(obj) {
    for (let x in obj) {
        if (obj.hasOwnProperty(x))
            yield obj[x];
    }
}

/**
 * yield all the (own) [key, value] pairs from the given object
 * @param obj object with key, value pairs to iterate over
 */
function items(obj) {
    for (let x in obj) {
        if (obj.hasOwnProperty(x))
            yield [x, obj[x]];
    }
}

/**
 * returns true if the given object is an iterator (i.e., it's an object with
 * a next() method)
 * @param obj object to test for iterator-ness
 */
function isIter(obj) {
    return ( ("object" == typeof obj)
             && ("next" in obj)
             && ("function" == typeof obj.next) );
}

/**
 * prints out an object
 * this has some magic for outputting (nested) iterators and it will also
 * stringify file objects to their leaf names, and it will JSON.stringify
 * other JS objects.  Strings get outputted directly.  Some of the magic
 * DWIM here may change in the future.
 * TODO: check if this is unicode-clean
 * @param obj object to output
 */
function output(obj, prefix) {
    if (prefix === undefined) prefix = "";
    if ("string" == typeof obj) {
        dump(prefix + '"' + obj + '"');
    } else if (isIter(obj)) {
        dump(prefix + "[\n");
        try {
            output(obj.next(), prefix + "  ");
        } catch (e if e instanceof StopIteration) {
        }
        for each (var elem in obj) {
            dump(",\n");
            output(elem, prefix + "  ");
        }
        dump("\n" + prefix + "]");
    } else if (obj instanceof Ci.nsIFile) {
        dump(prefix + '"' + obj.leafName + '"');
    } else {
        dump(prefix + JSON.stringify(obj));
    }
}

var result = eval(arguments[0]);
if (result !== undefined) {
    output(result);
    dump("\n");
}
