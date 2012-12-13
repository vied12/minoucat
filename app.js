// -----------------------------------------------------------------------------
// Project : MILF
// -----------------------------------------------------------------------------
// Author : Edouard Richard                                  <edou4rd@gmail.com>
// -----------------------------------------------------------------------------
// License : GNU Lesser General Public License
// -----------------------------------------------------------------------------
// Creation : 06-Dec-2012
// Last mod : 06-Dec-2012
// -----------------------------------------------------------------------------

var CONVERSATION_TIMEOUT = 0.1 // in minute

var flatiron    = require('flatiron'),
	path        = require('path'),
	plates      = require('plates'),
	fs          = require("fs"),
	app         = flatiron.app,
	io          = require('socket.io'),
	mongodb     = require('mongodb'),
	json        = require("JSON2"),
	chans       = {},
	users       = {},
	Db          = mongodb.Db;
var mongoUri    = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/socket'; 

app.use(flatiron.plugins.http, {});
app.use(flatiron.plugins.static, {root: __dirname});
app.config.file({ file: path.join(__dirname, 'config', 'config.json') });

// -----------------------------------------------------------------------------
// MONGODB
// -----------------------------------------------------------------------------
var collectionTalk = null;
Db.connect(mongoUri, function (err, db) {
	db.collection('talk', function(err, collection) {
		collectionTalk = collection;
	});
});
// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------
function render(_app, page, content, map) {
	fs.readFile(__dirname + page,'utf-8', function (err, html) {
		html = plates.bind(html,content, map);
		_app.res.writeHead(200,{'Content-Type': 'text/html;charset=utf-8'});
		_app.res.end(html,'utf-8');
	});
}

function getUsersListForChan(chan) {
	var users_in_chan   = [];
	var sockets_in_chan  = io.sockets.clients(chan);
	for (i=0; i<sockets_in_chan.length; i++) {
		var user = users[""+sockets_in_chan[i].id];
		if (user != null) {
			users_in_chan.push(users[""+sockets_in_chan[i].id]);
		}
	}
	return users_in_chan;
}
// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------
app.router.get('/', function () {
	var self = this;
	collectionTalk.find().toArray(function(err, conversations) {
		var data = {
			'chans'          : chans,
			'conversations'  : conversations
		};
		var content = {'data': escape(JSON.stringify(data))};
		var map     = plates.Map();
		map.where('class').is('Navigation').use('data').as('data-data');
		render(self, '/index.html', content, map);
	});
});

app.router.get('/chan/:chan', function (chan) {
	content = {chan: chan};
	var map = plates.Map();
	map.where('class').is('Chan').use('chan').as('data-chan');
	render(this, '/chan.html', content, map);
});

app.router.get('/log/:id', function (id) {
	var self = this;
	id = parseInt(id);
	collectionTalk.findOne({"date":id}, function(err, conversation) {
		// find next and previous conversations
		var next=null, previous=null;
		collectionTalk.distinct('date', function(err, dates) {
			var current = dates.indexOf(id);
			if (current > -1) {
				if (dates.length > current + 1)
					next = dates[current+1].toString();
				if (current > 0)
					previous = dates[current-1].toString(); 
			}
			data = {
				quotes   : conversation.quotes,
				next     : next,
				previous : previous
			}
			var content = {logs: escape(JSON.stringify(data))};
			var map = plates.Map();
			map.where('class').is('Log').use('logs').as('data-log');
			render(self, '/log.html', content, map);
		});
	});
});

// -----------------------------------------------------------------------------
// APPLICATION
// -----------------------------------------------------------------------------
var port = process.env.PORT || 5000;
app.start(port, function () {
	console.log('Application is now started on port ' + port);
	setInterval(function(){
		for (chan in chans) {
			// disable record mode if last message > 5min
			if (chans[chan].recording && chans[chan].last_message){
				var diff = new Date().getTime() - chans[chan].last_message;
				diff     = (diff/1000)/60; // minutes
				if (diff > CONVERSATION_TIMEOUT) {
					// end of conversation
					chans[chan].recording    = false;
					io.sockets.in(chan).emit('end_of_conversation', {conversation:chans[chan].conversation});
					chans[chan].conversation = null;
				}
			}
		}
	},1000);
	// -------------------------------------------------------------------------
	// SOCKET.IO
	// -------------------------------------------------------------------------
	io = io.listen(app.server);
	io.disable('heartbeats');
	io.configure(function () { 
		io.set("transports", ["xhr-polling"]);
		io.set("polling duration", 10);
	});
	io.sockets.on('connection', function(socket) {
		socket.on('join_chan', function(data) {
			var chan = data.name;
			socket.join(chan);
			// registrer the chan if doesn't exist
			if (chans[chan] == undefined) {
				chans[chan] = {recording:false, conversation:null, last_message:null, users_count:0};
			}
			chans[chan].users_count += 1;
			users[""+socket.id]      = data.user;
			users_in_chan            = getUsersListForChan(chan);
			io.sockets.in(chan).emit('new_user', {"new_user":data, "all_users":users_in_chan});
			// on new message
			socket.on('new_message', function(data) {
				// broadcast message
				io.sockets.in(chan).emit('new_message', data);
				// switch to record mode if msg > 4 words
				if (!chans[chan].recording && data.message.split(" ").length > 4) {
					chans[chan].recording = true;
					// create a conversation
					var conversation = {
						date   : new Date().getTime(),
						chan   : chan,
						quotes : [] 
					};
					chans[chan].conversation = conversation;
				}
				// record message
				if (chans[chan].recording) {
					data['date'] = new Date().getTime();
					chans[chan].last_message = data['date'];
					chans[chan].conversation.quotes.push(data);
					collectionTalk.update({"date":chans[chan].conversation.date}, chans[chan].conversation, {upsert:true});
				}
			});
			// on user disconnect
			socket.on('disconnect', function(data) {
				var user                 = users[socket.id]
				chans[chan].users_count -= 1;
				delete users[""+socket.id];
				var users_in_chan        = getUsersListForChan(chan);
				io.sockets.in(chan).emit('user_leave', {"user":user, "all_users":users_in_chan});
			});
		});
	});
});