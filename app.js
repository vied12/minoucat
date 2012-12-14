// -----------------------------------------------------------------------------
// Project : MiNOUCAT
// -----------------------------------------------------------------------------
// Author : Edouard Richard                                  <edou4rd@gmail.com>
// -----------------------------------------------------------------------------
// License : GNU Lesser General Public License
// -----------------------------------------------------------------------------
// Creation : 06-Dec-2012
// Last mod : 14-Dec-2012
// -----------------------------------------------------------------------------

var CONVERSATION_TIMEOUT = 5    // in minute
var TWEET_DELAY          = 10000 // in ms

var flatiron    = require('flatiron'),
	path        = require('path'),
	plates      = require('plates'),
	fs          = require("fs"),
	app         = flatiron.app,
	io          = require('socket.io'),
	mongodb     = require('mongodb'),
	json        = require("JSON2"),
	http        = require("http"),
	chans       = {},
	users       = {},
	Db          = mongodb.Db;
var mongoUri    = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/socket'; 

app.use(flatiron.plugins.http, {});
app.use(flatiron.plugins.static, {root: __dirname, fd: {
      max: 0}});
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

function recordQuote(author, message, chan) {
	var data = {
		author : author,
		message: message,
		date   : new Date().getTime()
	};
	chans[chan].conversation.quotes.push(data);
	collectionTalk.update({"date":chans[chan].conversation.date}, chans[chan].conversation, {upsert:true});
	return data;
}

function string_to_slug(str) {
	str = str.replace(/^\s+|\s+$/g, ''); // trim
	str = str.toLowerCase();

	// remove accents, swap ñ for n, etc
	var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
	var to   = "aaaaeeeeiiiioooouuuunc------";
	for (var i=0, l=from.length ; i<l ; i++) {
	str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
	}

	str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
	.replace(/\s+/g, '-') // collapse whitespace and replace by -
	.replace(/-+/g, '-'); // collapse dashes

	return str;
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
	})
});

app.router.get('/chan/:chan', function (chan) {
	content = {chan: chan};
	var map = plates.Map();
	map.where('class').is('Chan').use('chan').as('data-chan');
	render(this, '/chan.html', content, map);
});

app.router.get('/log/:id', function (id) {
	var self = this;
	collectionTalk.findOne({"permalink":id}, function(err, conversation) {
		// find next and previous conversations
		var next=null, previous=null;
		collectionTalk.findOne({'date': {'$gt': conversation.date}}, { limit : 1, sort: [['date', 'asc']] }, function(err, next) {
			collectionTalk.findOne({'date': {'$lt': conversation.date}}, { limit : 1, sort: [['date', 'desc']] }, function(err, previous) {
				if (next     != null) next     = next.permalink;
				if (previous != null) previous = previous.permalink;
				data = {
					quotes   : conversation.quotes,
					next     : next,
					previous : previous
				};
				var content = {logs: escape(JSON.stringify(data))};
				var map     = plates.Map();
				map.where('class').is('Log').use('logs').as('data-log');
				render(self, '/log.html', content, map);
			});
		});
	});
});

// -----------------------------------------------------------------------------
// APPLICATION
// -----------------------------------------------------------------------------
var port = process.env.PORT || 5000;
app.start(port, function () {
	console.log('Application is now started on port ' + port);
	// check if the conversation is over
	setInterval(function(){
		for (chan in chans) {
			// disable record mode if last message > 5min
			if (chans[chan].last_message){
				var diff = new Date().getTime() - chans[chan].last_message;
				diff     = (diff/1000)/60; // minutes
				if (diff > CONVERSATION_TIMEOUT) {
					// end of conversation
					if (chans[chan].recording) {
						io.sockets.in(chan).emit('end_of_conversation', {conversation:chans[chan].conversation});
					}
					chans[chan].recording    = false;
					chans[chan].conversation = null;
				}
			}
		}
	},1000);
	// add tweets to conversations
	setInterval(function(){
		for (chan in chans) {
			// only for recorded conversation
			if (chans[chan].recording && chans[chan].tweets == null) {
				var opt = {
					host   : "search.twitter.com",
					port   : 80,
					path   : "/search.json?lang=fr&q="+chan,
					method : "GET"
				};
				var req = http.request(opt, function(res) {
					var str = "";
					res.on("data", function(chunk) {
						str += chunk
						try {
							var data           = JSON.parse(str);
							chans[chan].tweets = data.results;
						} catch (ex) {}
					});
				});
				req.end();
			}
			// only for recorded conversation
			if (chans[chan].recording && chans[chan].tweets != null) {
				var t  = chans[chan].tweets.shift();
				if (t != null) {
					var tweet = {
						author  : t.from_user_name,
						message : t.text
					};
					io.sockets.in(chan).emit('tweet', tweet);
					recordQuote(tweet.author, tweet.message, chan);
				}
			}
		}
	},TWEET_DELAY);
	// -------------------------------------------------------------------------
	// SOCKET.IO
	// -------------------------------------------------------------------------
	io = io.listen(app.server);
	// io.disable('heartbeats');
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
				chans[chan] = {recording:false, conversation:null, last_message:null, users_count:0, tweets: null};
			}
			chans[chan].users_count += 1;
			users[""+socket.id]      = data.user;
			users_in_chan            = getUsersListForChan(chan);
			io.sockets.in(chan).emit('new_user', {"new_user":data, "all_users":users_in_chan});
			// on new message
			socket.on('new_message', function(data) {
				// broadcast message
				io.sockets.in(chan).emit('new_message', data);
				if (chans[chan].conversation == null) {
					// create a conversation
					chans[chan].conversation = {
						date      : new Date().getTime(),
						chan      : chan,
						permalink : null,
						quotes    : []
					};
				}
				// set a permalink if msg > 4 words
				if (!chans[chan].recording && data.message.split(" ").length > 4) {
					chans[chan].recording = true;
					chans[chan].conversation.permalink = string_to_slug(data.message);
					console.log('-------------------->', chans[chan]);
				}
				// record message
				// if (chans[chan].recording) {
				var quote = recordQuote(data.author, data.message, chan);
				chans[chan].last_message = quote['date'];
				// }
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