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

# -----------------------------------------------------------------------------
#
# CHAN
#
# -----------------------------------------------------------------------------
#  TODO
#  [X] contact list, get users at login (see room on socket.io)
#  [X] log discussions
#  [ ] what about logout ?
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
		@globalSocket  = io.connect("http://localhost")

	bindUI: (ui) =>
		super
		@cache.chan = @ui.attr("data-chan")
		this.relayout()
		if not currentUser?
			@uis.loginBox.removeClass("hidden").find("input").focus()
			this.onOkpressed(@uis.loginBox, this.registerUser)
		else
			this.connectToChan()
		# bind event
		$(window).resize(this.relayout)

	connectToChan: =>
		@globalSocket.emit('join_chan', {name:@cache.chan, user:@cache.currentUser})
		@globalSocket.on('new_user', (data) =>
			console.log("new user joined", data)
			this.refreshUserList(data)
		)
		@globalSocket.on('new_message', (data) =>
			console.log("new message recieve", data)
			this.addMessage(data.author, data.message)
		)
		this.onOkpressed(@uis.messageField.focus(), this.sendMessage)

	addMessage: (author, message) =>
		nui = this.cloneTemplate(@uis.quoteTmpl, {author_name: author, message:message})
		if author == @cache.currentUser
			nui.addClass("me")
		@uis.screen.append(nui)
		# scroll the screen to bottom
		@uis.screen[0].scrollTop = @uis.screen[0].scrollHeight

	refreshUserList: (data) =>
		console.log(data.new_user.user, "has joined", data.new_user.name)
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

	onOkpressed: (ui, cb) =>
		ui.keypress (e) =>
			if e.which == 13
				cb()

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
		@ACTIONS     = ["previous", "next"]
		@cache       = {quotes:null, previous:null, next:null}

	bindUI: (ui) =>
		super
		this.relayout()
		$(window).resize(this.relayout)
		this.setData()

	relayout: =>
		@uis.nav.css('padding-top', $(window).height()/2)

	setData: =>
		# data = document.location.pathname.split("/")[-1..][0]
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
$(document).ready => Widget.bindAll()

# EOF