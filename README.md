node-vim-netbeans
==========

it is cool

API
===

it is nice.

http://vimdoc.sourceforge.net/htmldoc/netbeans.html

VimServer
---------

### VimServer Functions

* **new VimServer**([options]) - Create and configure a new Vim NetBeans server. Options is an object with properties as follows:
    * __port__ - (`number|string`: defaults to 3219) the server binding port
    * __auth__ - (`function(password, client):boolean`: defaults to comparison with `options.password`) Authorization function for a newly connected client
    * __password__ - (`string|null`: defaults to null) Password that Vim clients should use when connecting. Ignored if `options.auth` is specified. Otherwise, if `options.password` is null, any password is accepted.

* **listen**([port], [callback]) - Bind the server to a port
    *  __port__ - (`number|string`) overwrite the constructor __port__ parameter
    * __callback__ - (`function`) called when the port is bound to the server

### VimServer Events

* **clientAuthed**(client) - A vim client successfully connected and supplied an acceptable password.
    * **client** - (`VimClient`) the client that connected

VimClient
---------

### VimClient Functions

* **key**(key, listener) - Register a function to be called when the vim user presses a certain key. Once set, a key listener cannot be removed, but you can change the listener function by calling `key(key, ...)` again.
    * **key** - (`string`) Key name. Supported are:
        * `'F1'`, `'F2'`, …, `'F12'` function keys
        * `' '` space
        * any ASCII printable character
        * `'X'` any unrecognized key

        The key may be prepended by `C`, `S` and/or `M`, with a hyphen,  for Control, Shift and Meta (Alt) modifiers. e.g.:
        * `'C-F2'` control-F2

    * **listener** - (`function(buffer, offset, lnum, col)`) called when the user presses the key. If `listener` is not a function, the events for the given key are ignored.
        * **buffer** - (`VimBuffer`) the buffer in which the key was pressed
        * **offset** - (`number`) byte offset of the cursor in the buffer
        * **lnum** - (`number`) line number of the cursor
        * **col** - (`number`) column number of the cursor

* **createBuffer**():buffer - Create and return an unnamed buffer, and make it the current buffer for the client.
    * **buffer** - (`VimBuffer`) the buffer created

* **editFile**(pathname, callback) - Open a file for editing.
    * **pathname** - (`string`) the file to edit
    * **callback** - (`function(buffer)`) called when the file has been opened
        * **buffer** - (`VimBuffer`) the newly created buffer

* **raise**() - Bring the editor to the foreground. *Only when Vim is run with a GUI.*

* **showBalloon**(text) - Display a balloon/tooltip at the mouse position, containing some text. It disappears when the mouse moves away. *Only when Vim is run with a GUI.*
    * **text** - (`string`) text to show in the balloon

* **getCursor**(callback) - Get the current buffer and cursor position.
    * **callback** - (`function(buffer, lnum, col, offset)`)
        * **buffer** - (`VimBuffer|null`) the current buffer, or null if it is a mystery
        * **lnum** - (`number`) - line number of the cursor (first line is one)
        * **col** - (`number`) - column number of the cursor (in bytes, zero based)
        * **offset** - (`number`) offset of the cursor in the buffer (in bytes)

* **getModified**(callback) - Get the number of buffers with changes
    * **callback** - (`function(num)`)
        * **num** - (`number`) number of buffers with changes

* **saveAndExit**(callback) - Ask the client to save all buffers and exit. If the user cancels this operation, the number of modified buffers is returned.
    * **callback** - (`function(result)`)
        * **result** - (`number|null`) number of modified buffers, or null if the client exited and closed the connection.

### VimClient Events

VimBuffer
---------

### VimBuffer Functions

### VimBuffer Events

AnnotationType
--------------

