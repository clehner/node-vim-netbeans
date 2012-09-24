node-vim-netbeans
=================

An implementation of the [Netbeans Protocol](http://vimdoc.sourceforge.net/htmldoc/netbeans.html), a socket interface designed for Vim integration into an IDE.

**vim-netbeans** allows you to create servers that Vim clients can connect to. You can control the Vim clients and get notifications about what they are doing.

The protocol is named NetBeans for historical reasons, and does not actually require the NetBeans IDE or Java.

Installation
------------

    npm install vim-netbeans

Usage
-----

```js
var nb = require("vim-netbeans");
var server = new nb.VimServer();
server.on("clientAuthed", function (vim) {
	vim.on("insert", function (buffer, offset, text) {
		console.log("Inserted text at " + offset + ": " + text);
	});

	vim.on("remove", function (buffer, offset, length) {
		console.log("Removed " + length + " bytes at " + offset);
	});
});
server.listen();
```

See `example.js` for a larger example.

Connecting
----------

To connect to your NetBeans server, launch Vim with `-nb` or use the command `:nbs` in Vim.  To close the connection, Use `:nbc`.

Host, port, and password can be specified with `:nbs:{hostname}:{port}:{password}`

Connection information can also be read from a file or environment. See the [Vim Documentation](http://vimdoc.sourceforge.net/htmldoc/netbeans.html#netbeans-run).

API Documentation
=================

This API is an abstraction over the [Vim Netbeans Protocol](http://vimdoc.sourceforge.net/htmldoc/netbeans.html), a socket interface intended for Vim integration into an IDE.

VimServer
---------

A server that listens for connections from Vim.

### VimServer Properties

* **server** (`net.Server`) underlying socket server
* **auth** (`function`) authorization function for connecting clients

### VimServer Functions

* **new VimServer**([options]) - Create and configure a new Vim NetBeans server, with properties as follows:
    * **port** - (`number|string`: defaults to 3219) the server binding port
    * **auth** - (`function(password, client):boolean`: defaults to comparison with `options.password`) Authorization function for a newly connected client
    * **password** - (`string|null`: defaults to null) Password that Vim clients should use when connecting. Ignored if `options.auth` is specified. Otherwise, if `options.password` is null, any password is accepted.
    * **debug** - (`boolean`: defaults to false) If true, socket communication will be printed.

* **listen**([port], [callback]) - Bind the server to a port
    * **port** - (`number|string`) overwrite the constructor **port** parameter
    * **callback** - (`function`) called when the port is bound to the server

### VimServer Events

* **clientAuthed**(client) - A vim client successfully connected and supplied an acceptable password.
    * **client** - (`VimClient`) the client that connected

VimClient
---------

Represents a Vim program that has connected to a VimServer.

### VimClient properties

* **socket** (`net.Socket`) underlying socket connection

* **server** (`VimServer`) the server managing this client connection

* **buffers** (`array<VimBuffer|null>`) buffers we are controlling. Indexed by `buffer.id`, starting at 1. Buffers that were removed have `null` in their places.

### VimClient Functions

* **disconnect**() - Break the connection and quit Vim. Only send when there are no unsaved changes. See also `saveAndExit`.

* **detatch**() - Break the connection without exiting the editor.

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

* **raise**() - Bring the editor to the foreground. *Requires Vim with GUI.*

* **showBalloon**(text) - Display a balloon/tooltip at the mouse position, containing some text. It disappears when the mouse moves away. *Requires Vim with GUI.*
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

* **saveAndExit**(callback) - Ask the client to save all buffers and exit (`:confirm qall`). If the user cancels this operation, the number of modified buffers is returned.
    * **callback** - (`function(result)`)
        * **result** - (`number|null`) number of modified buffers, or null if the client exited and closed the connection.

### VimClient Events

* **newBuffer**(buffer) - The client has opened a new buffer and we are claiming it. Also fired if the user presses a special key in a buffer weNot fired if the server creates the buffer with `createBuffer` or `editFile`.
    * **buffer** - (`VimBuffer`) the new buffer

* **disconnect**() - Vim is exiting.

* **disconnected**() - The connection with the client has closed. After this event, all listeners for the client and its buffers will be removed.

* **fileOpened**(pathname) - A file was opened by the user.
    * **pathname** - (`string`) name of the file

* **startupDone**() - The editor has finished its startup work and is ready for editing files.

* **version**(version) - Reports the version of the NetBeans interface. **node-vim-netbeans** assumes the version is 2.5. Some functions and events do not work in older versions.
    * **version** - (`string`)

In addition to these events, a VimClient also receives events for buffers that it has control of, with the VimBuffer object added as the first argument.

This allows you to do this:
```js
client.on("insert", function (buffer, text, offset) {...});
client.on("remove", function (buffer, text, offset) {...});
```

instead of this:
```js
client.on("newBuffer", function (buffer) {
	buffer.on("insert", function (text, offset) {...});
	buffer.on("remove", function (text, offset) {...});
});
```

VimBuffer
---------

A specific buffer in a Vim client that a VimServer controls.

### VimBuffer properties

* **client** (`VimClient`) client connection that has this buffer
* **id** (`number`) sequential buffer id, starting from 1 for each client

### VimBuffer Functions

* **addAnno**(type, offset):id Place an annotation at a position in the buffer.
    * **type** - (`AnnotationType`) the annotation type
    * **offset** - (`number`) byte offset to place the annotation at.
    * **id** - (`number`) Annotation ID is returned, for use with `removeAnno`

* **defineAnnoType**(type) Define an annotation type in the buffer. This is done automatically the first time you use the type in a buffer, but if you change the annotation type you may use this method to give the buffer the updated version.
    * **type** - (`AnnotationType`) the type

* **removeAnno**(id) Remove a previously placed annotation.
    * **id** - (`number`) the annotation ID as returned from `addAnno`.

* **close**() Close the buffer. This leaves us without current buffer, very dangerous to use! (according to the NetBeans API docs)

* **editFile**(pathname) Edit a file in the buffer.
    * **pathname** - (`string`) file to edit

* **guard**(offset, length) Mark an area in the buffer as guarded. This means it cannot be edited.
    * **offset** - (`number`) byte position of text in buffer to be guarded
    * **length** - (`number`) length of text

* **initDone**() Mark the buffer as ready to use. Makes it the current buffer. Fires the [BufReadPost](http://vimdoc.sourceforge.net/htmldoc/autocmd.html#BufReadPost) [autocommand](http://vimdoc.sourceforge.net/htmldoc/autocmd.html#autocommand) event (NetBeans API docs).

* **insertDone**() Tell Vim an initial file insert is done. This triggers Vim to print a read message.

* **netbeansBuffer**(own) Set whether this buffer is owned by NetBeans.
    * **own** - (`boolean`)

* **save**() Save the buffer. Vim should write the buffer unless one of these conditions is true:
    * [`write`](http://vimdoc.sourceforge.net/htmldoc/options.html#'write') is not set
    * the buffer is read-only
    * the buffer has no file name
    * [`buftype`](http://vimdoc.sourceforge.net/htmldoc/options.html#'buftype') disallows writing

* **saveDone**() Tell Vim a save is done. This triggers Vim to print a save message.

* **setDot**(offset), **setDot**(lnum, col) Make the buffer the current buffer and set the cursor at the specified position. If the buffer is open in another window, make that window the current window. If there are folds, they are opened to make the cursor line visible.
    * **offset** - (`number`) position to set cursor at
    * **lnum** - (`number`) line number to set cursor at
    * **col** - (`number`) column number to set cursor at

* **setFullName**(pathname) Set the file name of the buffer, and make the buffer the current buffer, but do not read from the file.
    * **pathname** - (`string`) file name

* **setModified**(modified) Mark the buffer as modified or unmodified.
    * **modified** - (`boolean`)

* **setModtime**(time) Change what Vim considers as the modification time of the file.
    * **time** - (`Date`) modification date object

* **setReadOnly**() Mark the buffer as readonly.

* **setTitle**(name) Set the title for the buffer. Unknown what this is actually useful for.

* **setVisible**(visible) If true, go to the buffer.
    * **visible** - (`boolean`) whether to show the buffer or not

* **startDocumentListen**() Mark the buffer to report insert and remove events

* **stopDocumentListen**() Stop reporting insert and remove events for this buffer. Note: if `netbeansBuffer` was used to mark this buffer as a NetBeans buffer, then the buffer is deleted in Vim. 

* **unguard**() Removing guarding for a text area. Also sets the current buffer, if necessary.
    * **offset** - (`number`) byte position of text to unguard
    * **length** - (`number`) length of text area

* **getLength**(callback) Get the length of the buffer in bytes.
    * **callback** - (`function(length)`)
        * **length** - (`number`) length of the buffer

* **getCursor**(callback) Get the cursor position if it is in this buffer
    * **callback** - (`function(lnum, col, offset)`)
		Values are null if this buffer is not the current buffer.
        * **lnum** - (`number|null`) line number of the cursor (from 1)
        * **col** - (`number|null`) column the cursor (in bytes, from 0)
        * **offset** - (`number|null`) byte offset of the cursor the buffer

* **getAnno**(id, callback) Find an annotation in the buffer.
    * **id** - (`number`) ID of the annotation, from `addAnno`
    * **callback** - (`function(lnum)`)
        * **lnum** - (`number`) line number of the annotation

* **getModified**(callback) Check if the buffer has changes.
    * **callback** - (`function(modified)`)
        * **modified** - (`boolean`) whether the buffer is modified or not

* **getText**(callback) Get the contents of the buffer
    * **callback** - (`function(text)`)
        * **text** - (`string`) buffer contents

* **insert**(offset, text, [callback]) Insert text before a position in the buffer. Sets the current buffer, if necessary. Does not move the cursor to the changed text. Resets undo information.
    * **offset** - (`number`) position for text. If it points to the start of a line, The text is inserted above this line. If it points after the start of a line, the text is inserted after the line.
    * **text** - (`string`) the text to insert
    * **callback** - (`function(error)`)
        * **error** - (`string|null`) Error message on failure, null on success

* **remove**(offset, length, [callback]) Delete some text in the buffer.
    * **offset** - (`number`) position to remove text at
    * **length** - (`string`) number of bytes to remove
    * **callback** - (`function(error)`)
        * **error** - (`string|null`) Error message on failure, null on success

### VimBuffer Events

* **balloonText**(text) - Used when [`ballooneval`](http://vimdoc.sourceforge.net/htmldoc/options.html#'ballooneval') is set and the mouse rests on some text for a moment. *Requires Vim with GUI.*
    * **text** - (`string`) the text under the mouse pointer

* **buttonRelease**(button, lnum, col) - Report which button was pressed and the location of the cursor at the time of the release.  Only for buffers that are owned by the Vim Controller.  This event is not sent if the button was released while the mouse was in the status line or in a separator line.
    * **button** - (`number?`) which button was pressed
    * **lnum** - (`number`) line number of where the mouse clicked
    * **col** - (`number`) column number. If < 1, the button releas was in the sign area.

* **fileOpened**(pathname) - The user reopened the file in the buffer, perhaps by using `:e`)
    * **pathname** - (`string`) name of the file. Should be same as `buffer.pathname`

* **geometry**(cols, rows, x, y) - Report the size and position of the editor window. *Only works for Motif*
    * **cols** - (`number`) number of text columns
    * **rows** - (`number`) number of text rows
    * **x** - (`number`) pixel position on screen
    * **y** - (`number`) pixel position on screen

* **insert**(offset, text) - Text has been inserted in Vim. Only fired when enabled with `startDocumentListen`.
    * **offset** - (`number`) position of text in buffer
    * **text** - (`string`) the inserted text.

* **remove**(offset, length) - Text was deleted in Vim. Only fired when enabled with `startDocumentListen`.
    * **offset** - (`number`) position in buffer
    * **length** - (`number`) bytes removed

* **killed**() - The user deleted a file and the buffer has been removed. Event listeners will be cleaned up.

* **save**() - The buffer has been saved and is now unmodified. Only fired when enabled with `startDocumentListen`.

* **unmodified**() - The buffer is now unmodified. Only fired when enabled with `startDocumentListen`.

AnnotationType
--------------

AnnotationTypes are used for adding text annotations with `buffers.addAnno`.

### AnnotationType Properties
* **name** - (`string|null`) name that identifies this annotation. (TODO: find where this is used)
* **glyph** - (`string|null`) Name of icon file. If one or two characters long, it defines a text sign instead.
* **fg** - (`string|number|null`) foreground color for line highlighting
* **bg** - (`string|number|null`) background color for line highlighting

When both __fg__ and __bg__ are null, no line highlighting is used.

Color names are defined in the color lists in the Vim documentation, [highlight-ctermfg](http://vimdoc.sourceforge.net/htmldoc/syntax.html#highlight-ctermfg) and [gui-colors](http://vimdoc.sourceforge.net/htmldoc/syntax.html#gui-colors).

Color values may also be "#rrggbb", or a numeric value thereof, and these are only defined for GVim.

### AnnotationType Functions

* **new AnnotationType**(options) - Create an annotation type with given options.
    * **options** - (`object`) see **AnnotationType Properties**

