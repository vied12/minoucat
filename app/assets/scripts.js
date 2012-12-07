var Widget, isDefined,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
  __hasProp = Object.prototype.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
  _this = this;

window.serious = {};

window.serious.Utils = {};

isDefined = function(obj) {
  return typeof obj !== 'undefined' && obj !== null;
};

jQuery.fn.opacity = function(o) {
  return $(this).css({
    opacity: o
  });
};

window.serious.Utils.clone = function(obj) {
  var flags, key, newInstance;
  if (!(obj != null) || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp) {
    flags = '';
    if (obj.global != null) flags += 'g';
    if (obj.ignoreCase != null) flags += 'i';
    if (obj.multiline != null) flags += 'm';
    if (obj.sticky != null) flags += 'y';
    return new RegExp(obj.source, flags);
  }
  newInstance = new obj.constructor();
  for (key in obj) {
    newInstance[key] = window.serious.Utils.clone(obj[key]);
  }
  return newInstance;
};

jQuery.fn.cloneTemplate = function(dict, removeUnusedField) {
  var klass, nui, value;
  if (removeUnusedField == null) removeUnusedField = false;
  nui = $(this[0]).clone();
  nui = nui.removeClass("template hidden").addClass("actual");
  if (typeof dict === "object") {
    for (klass in dict) {
      value = dict[klass];
      if (value !== null) nui.find(".out." + klass).html(value);
    }
    if (removeUnusedField) {
      nui.find(".out").each(function() {
        if ($(this).html() === "") return $(this).remove();
      });
    }
  }
  return nui;
};

window.serious.Widget = (function() {

  function Widget() {
    this.cloneTemplate = __bind(this.cloneTemplate, this);
    this.show = __bind(this.show, this);
    this.hide = __bind(this.hide, this);
    this.set = __bind(this.set, this);
  }

  Widget.bindAll = function() {
    return $(".widget").each(function() {
      return Widget.ensureWidget($(this));
    });
  };

  Widget.ensureWidget = function(ui) {
    var widget, widget_class;
    ui = $(ui);
    if (ui[0]._widget != null) {
      return ui[0]._widget;
    } else {
      widget_class = Widget.getWidgetClass(ui);
      if (widget_class != null) {
        widget = new widget_class();
        widget.bindUI(ui);
        return widget;
      } else {
        console.warn("widget not found for", ui);
        return null;
      }
    }
  };

  Widget.getWidgetClass = function(ui) {
    return eval("(" + $(ui).attr("data-widget") + ")");
  };

  Widget.prototype.bindUI = function(ui) {
    var action, key, nui, value, _i, _len, _ref, _ref2, _results;
    this.ui = $(ui);
    if (this.ui[0]._widget) delete this.ui[0]._widget;
    this.ui[0]._widget = this;
    this.uis = {};
    if (typeof this.UIS !== "undefined") {
      _ref = this.UIS;
      for (key in _ref) {
        value = _ref[key];
        nui = this.ui.find(value);
        if (nui.length < 1) console.warn("uis", key, "not found in", ui);
        this.uis[key] = nui;
      }
    }
    if (typeof this.ACTIONS !== "undefined") {
      _ref2 = this.ACTIONS;
      _results = [];
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        action = _ref2[_i];
        _results.push(this._bindClick(this.ui.find(".do[data-action=" + action + "]"), action));
      }
      return _results;
    }
  };

  Widget.prototype.set = function(field, value, context) {
    context = context || this.ui;
    context.find(".out[data-field=" + field + "]").html(value);
    return context;
  };

  Widget.prototype.hide = function() {
    return this.ui.addClass("hidden");
  };

  Widget.prototype.show = function() {
    return this.ui.removeClass("hidden");
  };

  Widget.prototype.cloneTemplate = function(template_nui, dict, removeUnusedField) {
    var action, action_name, actions, klass, nui, value, _i, _len;
    if (removeUnusedField == null) removeUnusedField = false;
    nui = template_nui.clone();
    nui = nui.removeClass("template hidden").addClass("actual");
    if (typeof dict === "object") {
      for (klass in dict) {
        value = dict[klass];
        if (value !== null) nui.find(".out." + klass).html(value);
      }
      if (removeUnusedField) {
        nui.find(".out").each(function() {
          if ($(this).html() === "") return $(this).remove();
        });
      }
    }
    actions = nui.find(".do");
    for (_i = 0, _len = actions.length; _i < _len; _i++) {
      action = actions[_i];
      action = $(action);
      action_name = action.data("action");
      this._bindClick(action, action_name);
    }
    return nui;
  };

  Widget.prototype._bindClick = function(nui, action) {
    var _this = this;
    if ((action != null) && __indexOf.call(this.ACTIONS, action) >= 0) {
      return nui.click(function(e) {
        _this[action](e);
        return e.preventDefault();
      });
    }
  };

  return Widget;

})();

window.serious.URL = (function() {

  function URL() {
    this.toString = __bind(this.toString, this);
    this.fromString = __bind(this.fromString, this);
    this.enableLinks = __bind(this.enableLinks, this);
    this.updateUrl = __bind(this.updateUrl, this);
    this.hasBeenAdded = __bind(this.hasBeenAdded, this);
    this.hasChanged = __bind(this.hasChanged, this);
    this.remove = __bind(this.remove, this);
    this.update = __bind(this.update, this);
    this.set = __bind(this.set, this);
    this.onStateChanged = __bind(this.onStateChanged, this);
    this.get = __bind(this.get, this);
    var _this = this;
    this.previousHash = [];
    this.handlers = [];
    this.hash = this.fromString(location.hash);
    $(window).hashchange(function() {
      var handler, _i, _len, _ref, _results;
      _this.previousHash = window.serious.Utils.clone(_this.hash);
      _this.hash = _this.fromString(location.hash);
      _ref = _this.handlers;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        handler = _ref[_i];
        _results.push(handler());
      }
      return _results;
    });
  }

  URL.prototype.get = function(field) {
    if (field == null) field = null;
    if (field) {
      return this.hash[field];
    } else {
      return this.hash;
    }
  };

  URL.prototype.onStateChanged = function(handler) {
    return this.handlers.push(handler);
  };

  URL.prototype.set = function(fields, silent) {
    var hash, key, value;
    if (silent == null) silent = false;
    hash = silent ? this.hash : window.serious.Utils.clone(this.hash);
    hash = [];
    for (key in fields) {
      value = fields[key];
      if (isDefined(value)) hash[key] = value;
    }
    return this.updateUrl(hash);
  };

  URL.prototype.update = function(fields, silent) {
    var hash, key, value;
    if (silent == null) silent = false;
    hash = silent ? this.hash : window.serious.Utils.clone(this.hash);
    for (key in fields) {
      value = fields[key];
      if (isDefined(value)) {
        hash[key] = value;
      } else {
        delete hash[key];
      }
    }
    return this.updateUrl(hash);
  };

  URL.prototype.remove = function(key, silent) {
    var hash;
    if (silent == null) silent = false;
    hash = silent ? this.hash : window.serious.Utils.clone(this.hash);
    if (hash[key]) delete hash[key];
    return this.updateUrl(hash);
  };

  URL.prototype.hasChanged = function(key) {
    if (this.hash[key] != null) {
      if (this.previousHash[key] != null) {
        return this.hash[key].toString() !== this.previousHash[key].toString();
      } else {
        return true;
      }
    } else {
      if (this.previousHash[key] != null) return true;
    }
    return false;
  };

  URL.prototype.hasBeenAdded = function(key) {
    return console.error("not implemented");
  };

  URL.prototype.updateUrl = function(hash) {
    if (hash == null) hash = null;
    return location.hash = this.toString(hash);
  };

  URL.prototype.enableLinks = function(context) {
    var _this = this;
    if (context == null) context = null;
    return $("a.internal[href]", context).click(function(e) {
      var href, link;
      link = $(e.currentTarget);
      href = link.attr("data-href") || link.attr("href");
      if (href[0] === "#") {
        if (href.length > 1 && href[1] === "+") {
          _this.update(_this.fromString(href.slice(2)));
        } else if (href.length > 1 && href[1] === "-") {
          _this.remove(_this.fromString(href.slice(2)));
        } else {
          _this.set(_this.fromString(href.slice(1)));
        }
      }
      return false;
    });
  };

  URL.prototype.fromString = function(value) {
    var hash, item, key, key_value, val, _i, _len;
    value = value || location.hash;
    hash = [];
    value = value.split("&");
    for (_i = 0, _len = value.length; _i < _len; _i++) {
      item = value[_i];
      if (item != null) {
        key_value = item.split("=");
        if (key_value.length === 2) {
          key = key_value[0].replace("#", "");
          val = key_value[1].replace("#", "");
          hash[key] = val;
        }
      }
    }
    return hash;
  };

  URL.prototype.toString = function(hash_list) {
    var key, new_hash, value;
    if (hash_list == null) hash_list = null;
    hash_list = hash_list || this.hash;
    new_hash = "";
    for (key in hash_list) {
      value = hash_list[key];
      new_hash += "&" + key + "=" + value;
    }
    return new_hash;
  };

  return URL;

})();

window.milf = {};

Widget = window.serious.Widget;

milf.Chan = (function(_super) {

  __extends(Chan, _super);

  function Chan() {
    this.registerUser = __bind(this.registerUser, this);
    this.onOkpressed = __bind(this.onOkpressed, this);
    this.relayout = __bind(this.relayout, this);
    this.sendMessage = __bind(this.sendMessage, this);
    this.refreshUserList = __bind(this.refreshUserList, this);
    this.addMessage = __bind(this.addMessage, this);
    this.connectToChan = __bind(this.connectToChan, this);
    this.bindUI = __bind(this.bindUI, this);    this.UIS = {
      quoteTmpl: ".template.quote",
      contactTmpl: ".template.contact",
      screen: ".screen",
      contacts: ".contacts",
      sendPanel: ".send-panel",
      messageField: "input[name=message]",
      loginBox: ".overlay",
      usernameField: "input[name=username]"
    };
    this.ACTIONS = ["sendMessage"];
    this.cache = {
      currentUser: null,
      chan: null
    };
    this.globalSocket = io.connect("http://localhost");
  }

  Chan.prototype.bindUI = function(ui) {
    Chan.__super__.bindUI.apply(this, arguments);
    this.cache.chan = this.ui.attr("data-chan");
    this.relayout();
    if (!(typeof currentUser !== "undefined" && currentUser !== null)) {
      this.uis.loginBox.removeClass("hidden").find("input").focus();
      this.onOkpressed(this.uis.loginBox, this.registerUser);
    } else {
      this.connectToChan();
    }
    return $(window).resize(this.relayout);
  };

  Chan.prototype.connectToChan = function() {
    var _this = this;
    this.globalSocket.emit('join_chan', {
      name: this.cache.chan,
      user: this.cache.currentUser
    });
    this.globalSocket.on('new_user', function(data) {
      console.log("new user joined", data);
      return _this.refreshUserList(data);
    });
    this.globalSocket.on('new_message', function(data) {
      console.log("new message recieve", data);
      return _this.addMessage(data.author, data.message);
    });
    return this.onOkpressed(this.uis.messageField.focus(), this.sendMessage);
  };

  Chan.prototype.addMessage = function(author, message) {
    var nui;
    nui = this.cloneTemplate(this.uis.quoteTmpl, {
      author_name: author,
      message: message
    });
    if (author === this.cache.currentUser) nui.addClass("me");
    this.uis.screen.append(nui);
    return this.uis.screen[0].scrollTop = this.uis.screen[0].scrollHeight;
  };

  Chan.prototype.refreshUserList = function(data) {
    var nui, user, _i, _len, _ref, _results;
    console.log(data.new_user.user, "has joined", data.new_user.name);
    this.uis.contacts.find('.actual').remove();
    _ref = data.all_users;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      nui = this.cloneTemplate(this.uis.contactTmpl, {
        username: user
      });
      _results.push(this.uis.contacts.append(nui));
    }
    return _results;
  };

  Chan.prototype.sendMessage = function() {
    var author, message;
    message = this.uis.messageField.val();
    author = this.cache.currentUser;
    this.globalSocket.emit('new_message', {
      author: author,
      message: message
    });
    return this.uis.messageField.val("");
  };

  Chan.prototype.relayout = function() {
    var height;
    height = $(window).height() - this.uis.screen.offset().top - this.uis.sendPanel.height();
    this.uis.screen.css("height", height);
    return this.uis.contacts.css("height", height);
  };

  Chan.prototype.onOkpressed = function(ui, cb) {
    var _this = this;
    return ui.keypress(function(e) {
      if (e.which === 13) return cb();
    });
  };

  Chan.prototype.registerUser = function() {
    this.cache.currentUser = this.uis.usernameField.val();
    this.uis.loginBox.addClass("hidden");
    this.connectToChan();
    return this.set("username", this.cache.currentUser);
  };

  return Chan;

})(Widget);

milf.Log = (function(_super) {

  __extends(Log, _super);

  function Log() {
    this.fill = __bind(this.fill, this);
    this.setData = __bind(this.setData, this);
    this.relayout = __bind(this.relayout, this);
    this.bindUI = __bind(this.bindUI, this);    this.UIS = {
      quoteTmpl: ".template.quote",
      body: ".body",
      nav: ".nav",
      next: "#next",
      previous: "#previous"
    };
    this.ACTIONS = ["previous", "next"];
    this.cache = {
      quotes: null,
      previous: null,
      next: null
    };
  }

  Log.prototype.bindUI = function(ui) {
    Log.__super__.bindUI.apply(this, arguments);
    this.relayout();
    $(window).resize(this.relayout);
    return this.setData();
  };

  Log.prototype.relayout = function() {
    return this.uis.nav.css('padding-top', $(window).height() / 2);
  };

  Log.prototype.setData = function() {
    var data;
    data = eval('(' + unescape(this.ui.attr('data-log')) + ')');
    this.cache.quotes = data.quotes;
    this.cache.previous = data.previous;
    this.cache.next = data.next;
    return this.fill();
  };

  Log.prototype.fill = function() {
    var nui, quote, _i, _len, _ref;
    this.set('date', new Date(this.cache.quotes[0].date).toLocaleString());
    this.set('chan', this.cache.quotes[0].chan);
    _ref = this.cache.quotes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      quote = _ref[_i];
      nui = this.cloneTemplate(this.uis.quoteTmpl, {
        author_name: quote.author,
        message: quote.message
      });
      this.uis.body.append(nui);
    }
    if (this.cache.next) {
      this.uis.next.attr('href', this.cache.next).addClass('active');
    } else {
      this.uis.next.attr('href', null).removeClass('active');
    }
    if (this.cache.previous) {
      return this.uis.previous.attr('href', this.cache.previous).addClass('active');
    } else {
      return this.uis.previous.attr('href', null).removeClass('active');
    }
  };

  return Log;

})(Widget);

$(document).ready(function() {
  return Widget.bindAll();
});
