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
    if ('undefined' == typeof charSet) charSet = "UTF-8";

    let convStream = Cc["@mozilla.org/intl/converter-input-stream;1"]
        .createInstance(Ci.nsIConverterInputStream);

    let url;
    if ("string" == typeof toRead) {
        url = _resolve(toRead);
    } else if (toRead instanceof Ci.nsIFile) {
        url = ioService.newFileURI(toRead);
    } else {
        throw new Error("lines(): couldn't handle argument: " + toRead);
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

    try {
        convStream.init(input, charSet, 1024, 0xFFFD);
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
        input.close();
    }
}

/**
 * list the files/directories for the given path
 * @param path path string
 * @return iterator over nsIFile objects
 */
function ls(path) {
    let dir = _fileForPath(path);
    if (dir.isDirectory()) {
        for each (let entry in _ls(dir, false))
            yield entry;
    } else {
        yield dir;
    }
}

/**
 * recursively list the files/directories for the given path
 * @param path path string
 * @return iterator over nsIFile objects
 */
function find(path) {
    let dir = _fileForPath(path);
    if (dir.isDirectory()) {
        for each (let entry in _ls(dir, true))
            yield entry;
    } else {
        yield dir;
    }
}

function _fileForPath(path) {
    if ("undefined" == typeof path) path = ".";
    let uri = _resolve(path);
    return uri.QueryInterface(Ci.nsIFileURL).file;
}

function _ls(dir, recurse) {
    let entries = dir.directoryEntries;
    while (entries.hasMoreElements()) {
        let entry = entries.getNext();
        entry.QueryInterface(Ci.nsIFile);
        yield entry;
        if (recurse && entry.isDirectory()) {
            for (subEntry in _ls(entry, recurse))
                yield subEntry;
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
    for (let line in lines(url, charSet)) {
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
function oal(iter, sep) {
    if ("undefined" == typeof sep) sep = "\t";
    for (let arr in iter) {
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
 * drop the first num items from iter
 * @param num number of items to drop
 * @param iter source iterator for items
 * @return iterator after num items have been dropped from it
 */
function drop(num, iter) {
    while (num > 0) {
        iter.next();
        num--;
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
    let result = [];
    for (let elem in iter) {
        result.push(elem);
        if (result.length > num) result.shift();
    }
    return values(result);
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
 * reduce an iterator with a function
 * @param iter source of items
 * @param fun reduce function, which should take two arguments
 * @param init starting value for the reduction
 * @return final result of the reduction
 */
function reduce(iter, fun, init) {
    let result = init;
    for (let elem in iter) {
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
    for (let elem in iter) {
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
    for (let elem in iter) {
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
    for (let elem in iter) {
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
    for (let elem in iter) {
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
function output(obj) {
    if ("string" == typeof obj) {
        print(obj);
    } else if (isIter(obj)) {
        //should we do something special for nested iterators?
        for (var elem in obj) {
            output(elem);
        }
    } else if (obj instanceof Ci.nsIFile) {
        print(obj.leafName);
    } else {
        print(JSON.stringify(obj));
    }
}

output(eval(arguments[0]));
