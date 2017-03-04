'use strict';
var Alexa = require('alexa-sdk');
var request = require("request");
var rq = require("request-promise");

var states = {
    CHECK_NOTIFICATION: '_CHECK_NOTIFICATION',
    CHOOSE_ABILITY: '_CHOOSE_ABILITY'
};

var welcomeMessage = "Welcome in Lunch App. You're looking for a person with what skill?";

var welcomeRepromt = "You can ask me to find someone with an interesting skill. What kind of skill you're interested in?";

var goodbyeMessage = "I hope you'll enjoy your lunch!";

var HelpMessage = "You can tell me what is the skill you're looking for.";

var moreInformation = "See your Alexa app for more information.";

var tryAgainMessage = "please try again.";

var output = "";

var alexa;

var newSessionHandlers = {
    'LaunchRequest': function () {
        this.attributes['current_user_id'] = 1;
        this.attributes['discarded_ids'] = [];
        var that = this;
        getNotificationsJSON(this).then(function (response) {
          if ( response.length > 0 ) {
            that.handler.state = states.CHECK_NOTIFICATION;
            that.attributes['current_notification'] = 0;
            that.attributes['unconfirmed_notifications'] = response;
            output = "You've got some invitations waiting for your attention. Do you want to check them?";
            that.emit(':ask', output, output);
          } else {
            that.handler.state = states.CHOOSE_ABILITY;
            output = welcomeMessage;
            that.emit(':ask', output, welcomeRepromt);
          }
        });
    },
    'getUsersWithAbility': function () {
        this.handler.state = states.CHOOSE_ABILITY;
        this.emitWithState('getUsersWithAbility');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', goodbyeMessage);
    },
    'AMAZON.CancelIntent': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit(":tell", goodbyeMessage);
    },
    'SessionEndedRequest': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit('AMAZON.StopIntent');
    },
    'Unhandled': function () {
        output = HelpMessage;
        this.emit(':ask', output, welcomeRepromt);
    },
};

var startGetUsersHandlers = Alexa.CreateStateHandler(states.CHOOSE_ABILITY, {
    'getUsersWithAbility': function () {
      this.attributes['ability_name'] = this.event.request.intent.slots.ability.value;
      var ability = this.attributes['ability_name'];
      var that = this;
      getJSON(this).then(function (response) {
        if ( response.length > 0 ) {
          that.attributes['chosen_person_data'] = response[0].user;
          var output = "I've found "+ that.attributes['chosen_person_data'].first_name +", do you like my choice?";
          that.emit(':ask', output);
        } else {
          that.emit(':tell', "I did't find any experts in "+ability+". Try to define the skill in a different way.");
        }
      });
    },
    'getNextUser': function () {
      var ability = this.attributes['ability_name'];
      var that = this;
      getJSON(this).then(function (response) {
        if ( response.length > 0 ) {
          that.attributes['chosen_person_data'] = response[0].user;
          var output = "I've found "+ that.attributes['chosen_person_data'].first_name +", do you like my choice?";
          that.emit(':ask', output);
        } else {
          that.emit(':tell', "I did't find any other experts in "+ability+". Try to define the skill in a different way.");
        }
      });
    },
    'AMAZON.YesIntent': function () {
        var that = this;
        postJSON(this).then(function (response) {
          output = "That's perfect! Meeting with "+that.attributes['chosen_person_data'].first_name;
          that.emit(':tell', output);
        });
    },
    'AMAZON.NoIntent': function () {
        this.attributes['discarded_ids'].push(this.attributes['chosen_person_data'].id);
        output = "If you want me to find another person with the same skill, say 'next'. If you want to change the skill - say 'change skill for' and the name of the skill.";
        this.emit(':ask', output, output);
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', goodbyeMessage);
    },
    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.emit(':ask', output, HelpMessage);
    },
    'AMAZON.CancelIntent': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit(":tell", goodbyeMessage);
    },
    'SessionEndedRequest': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit('AMAZON.StopIntent');
    },
    'Unhandled': function () {
        output = HelpMessage;
        this.emit(':ask', output, welcomeRepromt);
    }
});

var notificationsHandlers = Alexa.CreateStateHandler(states.CHECK_NOTIFICATION, {
    'getNextUser': function () {
      var current_notification = this.attributes['unconfirmed_notifications'][this.attributes['current_notification']];
      if (current_notification) {
        this.attributes['current_notification'] = this.attributes['current_notification'] + 1;
        var output = "Invitation from "+ current_notification.meeting.user.first_name + ". Confirm, reject, next invitation, or pass to looking for a lunch?";
        this.emit(':ask', output);
      } else {
        this.handler.state = states.CHOOSE_ABILITY;
        var output = "No more waiting invitations. You're looking for a person with what skill?";
        this.emit(':ask', output);
      }
    },
    'AMAZON.YesIntent': function () {
        var current_notification = this.attributes['unconfirmed_notifications'][this.attributes['current_notification']];
        this.attributes['current_notification'] = this.attributes['current_notification'] + 1;
        var output = "Invitation from "+ current_notification.meeting.user.first_name + ". Confirm, reject, next invitation, or pass to looking for a lunch?";
        this.emit(':ask', output);
    },
    'passToSearch': function () {
        this.handler.state = states.CHOOSE_ABILITY;
        output = welcomeMessage;
        this.emit(':ask', output, welcomeRepromt);
    },
    'confirmInvitation': function () {
        var that = this;
        postConfirmInvitaionJSON(this).then(function (response) {
          var output = "Meeting successfully confirmed.";
          that.attributes['current_notification'] = that.attributes['current_notification'] + 1;
          if (that.attributes['unconfirmed_notifications'][that.attributes['current_notification']]) {
            var current_notification = that.attributes['unconfirmed_notifications'][that.attributes['current_notification']];
            that.attributes['current_notification'] = that.attributes['current_notification'] + 1;
            output = output + "Invitation from "+ current_notification.meeting.user.first_name + ". Confirm, reject, next invitation, or pass to looking for a lunch?";
            that.emit(':ask', output);
          } else {
            that.handler.state = states.CHOOSE_ABILITY;
            output = output + "No more waiting invitations. You're looking for a person with what skill?";
            that.emit(':ask', output);
          }
        });
    },
    'rejectInvitation': function () {
        var that = this;
        postRejectInvitaionJSON(this).then(function (response) {
          var output = "Meeting successfully rejected.";
          that.attributes['current_notification'] = that.attributes['current_notification'] + 1;
          if (that.attributes['unconfirmed_notifications'][that.attributes['current_notification']]) {
            var current_notification = that.attributes['unconfirmed_notifications'][that.attributes['current_notification']];
            that.attributes['current_notification'] = that.attributes['current_notification'] + 1;
            output = output + "Invitation from "+ current_notification.meeting.user.first_name + ". Confirm, reject, next invitation, or pass to looking for a lunch?";
            that.emit(':ask', output);
          } else {
            that.handler.state = states.CHOOSE_ABILITY;
            output = output + "No more waiting invitations. You're looking for a person with what skill?";
            that.emit(':ask', output);
          }
        });
    },
    'AMAZON.NoIntent': function () {
        this.handler.state = states.CHOOSE_ABILITY;
        output = welcomeMessage;
        this.emit(':ask', output, output);
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', goodbyeMessage);
    },
    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.emit(':ask', output, HelpMessage);
    },
    'AMAZON.CancelIntent': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit(":tell", goodbyeMessage);
    },
    'SessionEndedRequest': function () {
        // Use this function to clear up and save any data needed between sessions
        this.emit('AMAZON.StopIntent');
    },
    'Unhandled': function () {
        output = HelpMessage;
        this.emit(':ask', output, welcomeRepromt);
    }
});


exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.registerHandlers(newSessionHandlers, startGetUsersHandlers, notificationsHandlers);
    alexa.execute();
};

function getJSON(that) {

    var options = {
        uri: "https://hidden-beach-26730.herokuapp.com/api/with_ability.json",
        qs: {
            ability_name: that.attributes['ability_name'],
            discarded_ids: that.attributes['discarded_ids']
        },
        json: true
    };

    return rq(options);
}

function getNotificationsJSON(that) {

    var options = {
        uri: "https://hidden-beach-26730.herokuapp.com/api/waiting_for_confirmation.json",
        qs: {
            current_user_id: that.attributes['current_user_id']
        },
        json: true
    };

    return rq(options);
}

function postJSON(that) {

    var options = {
      method: 'POST',
      uri: "https://hidden-beach-26730.herokuapp.com/api/set_meeting",
      body: {
          invitor_id: that.attributes['current_user_id'],
          invited_id: that.attributes['chosen_person_data'].id,
      },
      json: true // Automatically stringifies the body to JSON
    };

    return rq(options);
}

function postConfirmInvitaionJSON(that) {

    var options = {
      method: 'POST',
      uri: "https://hidden-beach-26730.herokuapp.com/api/confirm",
      body: {
          meeting_id: that.attributes['current_notification']
      },
      json: true // Automatically stringifies the body to JSON
    };

    return rq(options);
}

function postRejectInvitaionJSON(that) {

    var options = {
      method: 'POST',
      uri: "https://hidden-beach-26730.herokuapp.com/api/reject",
      body: {
          meeting_id: that.attributes['current_notification']
      },
      json: true // Automatically stringifies the body to JSON
    };

    return rq(options);
}
