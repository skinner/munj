let Cc = Components.classes;
let Ci = Components.interfaces;

let dirService = Cc["@mozilla.org/file/directory_service;1"]
    .getService(Ci.nsIDirectoryServiceProvider);
let ioService = Cc["@mozilla.org/network/io-service;1"]
    .getService(Ci.nsIIOService);

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

function ls(path) {
    if ("undefined" == typeof path) path = ".";

    let dirUri = _resolve(path);
    let dir = dirUri.QueryInterface(Ci.nsIFileURL).file;
    if (dir.isDirectory()) {
        let entries = dir.directoryEntries;
        while (entries.hasMoreElements()) {
            let entry = entries.getNext();
            entry.QueryInterface(Ci.nsIFile);
            yield entry;
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
    //don't think we have a platform-independent way to get other users'
    //home directories, so for now just hack ~ for the current user's
    let homeDir = ioService.newFileURI(dirService.getFile("Home", {}));
    return url.replace(/^\s*~/, homeDir.spec);
}

function ila(url, sep, charSet) {
    if ("undefined" == typeof sep) sep = "\t";
    for (let line in lines(url, charSet)) {
        yield line.split(sep);
    }
}

function oal(iter, sep) {
    if ("undefined" == typeof sep) sep = "\t";
    for (let arr in iter) {
        if (arr instanceof Array)
            yield (arr.join(sep));
        else
            yield arr;
    }
}

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

function take(num, iter) {
    while (num > 0) {
        yield iter.next();
        num--;
    }
}

function drop(num, iter) {
    while (num > 0) {
        iter.next();
        num--;
    }
    return iter;
}

function tail(num, iter) {
    let result = [];
    for (let elem in iter) {
        result.push(elem);
        if (result.length > num) result.shift();
    }
    return values(result);
}

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

function reduce(iter, fun, init) {
    let result = init;
    for (let elem in iter) {
        result = fun(result, elem);
    }
    return result;
}

function sum(iter) {
    let result = 0;
    for (let elem in iter) {
        result += parseFloat(elem);
    }
    return result;
}

function product(iter) {
    let result = 1;
    for (let elem in iter) {
        result *= parseFloat(elem);
    }
    return result;
}

function max(iter) {
    let result = iter.next();
    for (let elem in iter) {
        result = Math.max(result, elem);
    }
    return result;
}

function min(iter) {
    let result = iter.next();
    for (let elem in iter) {
        result = Math.min(result, elem);
    }
    return result;
}

function keys(obj) {
    for (let x in obj) {
        if (obj.hasOwnProperty(x))
            yield x;
    }
}

function values(obj) {
    for (let x in obj) {
        if (obj.hasOwnProperty(x))
            yield obj[x];
    }
}

function items(obj) {
    for (let x in obj) {
        if (obj.hasOwnProperty(x))
            yield [x, obj[x]];
    }
}

function isIter(obj) {
    return ( ("object" == typeof obj)
             && ("next" in obj)
             && ("function" == typeof obj.next) );
}

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
