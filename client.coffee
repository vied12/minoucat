# -----------------------------------------------------------------------------
# Project : MILF
# -----------------------------------------------------------------------------
# Author : Edouard Richard                                  <edou4rd@gmail.com>
# -----------------------------------------------------------------------------
# License : GNU Lesser General Public License
# -----------------------------------------------------------------------------
# Creation : 06-Dec-2012
# Last mod : 06-Dec-2012
# -----------------------------------------------------------------------------
# > No HTML in JS
# > Structured
# > Easy to integrate in an other web project
# > This is it, Serious Toolkit.

window.milf = {}
Widget      = window.serious.Widget

onOkpressed = (ui, cb) =>
	ui.keypress (e) =>
		if e.which == 13
			cb()
# -----------------------------------------------------------------------------
#
# CHAN
#
# -----------------------------------------------------------------------------
#  TODO
#  [X] contact list, get users at login (see room on socket.io)
#  [X] log discussions
#  [X] what about logout ?
class milf.Chan extends Widget

	constructor: ->
		@UIS = {
			quoteTmpl     : ".template.quote"
			contactTmpl   : ".template.contact"
			screen        : ".screen"
			contacts      : ".contacts"
			sendPanel     : ".send-panel"
			messageField  : "input[name=message]"
			loginBox      : ".overlay"
			usernameField : "input[name=username]"
		}
		@ACTIONS     = ["sendMessage"]
		@cache       = {
			currentUser: null
			chan       : null
		}
		@globalSocket  = io.connect(window.location.hostname)

	bindUI: (ui) =>
		super
		@cache.chan = @ui.attr("data-chan")
		this.relayout()
		if not currentUser?
			@uis.loginBox.removeClass("hidden").find("input").focus()
			onOkpressed(@uis.loginBox, this.registerUser)
		else
			this.connectToChan()
		# bind event
		$(window).resize(this.relayout)

	connectToChan: =>
		@globalSocket.emit('join_chan', {name:@cache.chan, user:@cache.currentUser})
		# On new user in chan
		@globalSocket.on('new_user', (data) =>
			console.log("new user joined", data)
			this.refreshUserList(data)
		)
		# On user leaving the chan
		@globalSocket.on('user_leave', (data) =>
			console.log("user leaving", data)
			this.refreshUserList(data)
		)
		# On new message
		@globalSocket.on('new_message', (data) =>
			console.log("new message recieve", data)
			this.addMessage(data.author, data.message)
		)
		# On new tweet
		@globalSocket.on('tweet', (data) =>
			console.log("new tweet recieve", data)
			this.addMessage(data.author, data.message)
		)
		# On end of a conversation
		@globalSocket.on('end_of_conversation', (data) =>
			console.log("end_of_conversation", data)
			link = 'http://'+window.location.host+'/log/'+ data.conversation.date
			this.addMessage("_LOG_", "La conversation a été archivée ici <a href=\""+link+"\">"+link+"</a>")
		)
		onOkpressed(@uis.messageField.focus(), this.sendMessage)

	addMessage: (author, message) =>
		nui = this.cloneTemplate(@uis.quoteTmpl, {author_name: author, message:message})
		if author == @cache.currentUser
			nui.addClass("me")
		@uis.screen.append(nui)
		# scroll the screen to bottom
		@uis.screen[0].scrollTop = @uis.screen[0].scrollHeight

	refreshUserList: (data) =>
		@uis.contacts.find('.actual').remove()
		for user in data.all_users
			nui = this.cloneTemplate(@uis.contactTmpl, {username:user})
			@uis.contacts.append(nui)

	sendMessage: =>
		message = @uis.messageField.val()
		author  = @cache.currentUser
		@globalSocket.emit('new_message', { author: author, message: message })
		@uis.messageField.val("")

	relayout: =>
		height = $(window).height() - @uis.screen.offset().top - @uis.sendPanel.height()
		@uis.screen.css("height", height)
		@uis.contacts.css("height", height)


	registerUser: =>
		@cache.currentUser = @uis.usernameField.val()
		@uis.loginBox.addClass("hidden")
		this.connectToChan()
		this.set("username", @cache.currentUser)

# -----------------------------------------------------------------------------
#
# LOG
#
# -----------------------------------------------------------------------------
class milf.Log extends Widget

	constructor: ->
		@UIS = {
			quoteTmpl : ".template.quote"
			body      : ".body"
			nav       : ".nav"
			next      : "#next"
			previous  : "#previous"
		}
		@ACTIONS = ["previous", "next"]
		@cache   = {quotes:null, previous:null, next:null}

	bindUI: (ui) =>
		super
		this.relayout()
		$(window).resize(this.relayout)
		this.setData()

	relayout: =>
		@uis.nav.css('padding-top', $(window).height()/2)

	setData: =>
		data = eval('(' + unescape(@ui.attr('data-log')) + ')')
		@cache.quotes   = data.quotes
		@cache.previous = data.previous
		@cache.next     = data.next
		this.fill()

	fill: =>
		this.set('date', new Date(@cache.quotes[0].date).toLocaleString())
		this.set('chan', @cache.quotes[0].chan)
		for quote in @cache.quotes
			nui = this.cloneTemplate(@uis.quoteTmpl, {author_name: quote.author, message:quote.message})
			@uis.body.append(nui)
		if @cache.next
			@uis.next.attr('href', @cache.next).addClass('active')
		else
			@uis.next.attr('href', null).removeClass('active')
		if @cache.previous
			@uis.previous.attr('href', @cache.previous).addClass('active')
		else
			@uis.previous.attr('href', null).removeClass('active')

# -----------------------------------------------------------------------------
#
# Navigation
#
# -----------------------------------------------------------------------------
class milf.Navigation extends Widget

	constructor: ->
		@UIS = {
			chanList          : '.chans'
			chanTmpl          : '.chan.template'
			conversationList  : '.logs'
			conversationTmpl  : '.log.template'
			joinField         : '.join input'
		}
		@ACTIONS = []
		@cache   = {chans : null, conversations : null}

	bindUI: (ui) =>
		super
		this.setData()
		onOkpressed @uis.joinField, =>
			window.location = 'http://'+window.location.host+'/chan/'+ @uis.joinField.val()
		# meny = Meny.create({
		# 	menuElement     : document.querySelector( @UIS.chanList )
		# 	contentsElement : document.querySelector( '.content' )
		# 	position        : 'left'
		# 	height          : 200
		# 	width           : 200
		# })
	setData: =>
		data = eval('(' + unescape(@ui.attr('data-data')) + ')')
		@cache.chans          = data.chans
		@cache.conversations  = data.conversations
		this.setChans()
		this.setConversations()

	setChans: =>
		for name, c of @cache.chans
			nui = this.cloneTemplate(@uis.chanTmpl, {name: name, nb_user: c.users_count})
			nui.find('a').attr('href', 'http://'+window.location.host+'/chan/'+ name)
			@uis.chanList.append(nui)

	setConversations: => 
		for conversation in @cache.conversations
			nui = this.cloneTemplate(@uis.conversationTmpl, {name: "##{conversation.chan}-#{new Date(conversation.date).toLocaleString()}"})
			nui.attr('data-log', conversation)
			nui.find('a').attr('href', 'http://'+window.location.host+'/log/'+ conversation.date)
			@uis.conversationList.append(nui)

$(document).ready => Widget.bindAll()

# EOF
