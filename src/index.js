'use strict';
var Alexa = require('alexa-sdk');
var request = require("request");
var rq = require("request-promise");
var dateFormat = require('dateformat');

var states = {
    CHECK_NOTIFICATION: '_CHECK_NOTIFICATION',
    CHOOSE_ABILITY: '_CHOOSE_ABILITY',
    CHOOSE_DATETIME: '_CHOOSE_DATETIME',
    ACCEPT_MEETING: '_ACCEPT_MEETING',
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
        this.attributes['current_user_id'] = 4;
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
          that.attributes['chosen_people'] = response;
          that.handler.state = states.CHOOSE_DATETIME;
          // var output = "I've found "+ that.attributes['chosen_person_data'].first_name +", do you like my choice?";
          that.emit(':ask', "When would you like to have a lunch?");
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

var setDateTimeMeetingHandlers = Alexa.CreateStateHandler(states.CHOOSE_DATETIME, {
    'getLunchDateTime': function () {
      this.attributes['date'] = new Date(this.event.request.intent.slots.date.value);
      this.attributes['time'] = this.event.request.intent.slots.time.value;
      this.attributes['day_number'] = this.attributes['date'].getDay();

      var that = this;
      getUsersDeadlineJSON(this).then(function (response) {
        if ( response.length > 0 ) {
          that.attributes['chosen_person_data'] = response[0].user;
          var output = "I've found "+ that.attributes['chosen_person_data'].first_name +" who is expert in "+that.attributes['ability_name']+". "+that.attributes['chosen_person_data'].first_name+" can help in "+that.attributes['chosen_person_data'].good_at +". Is that the person that you're looking for?";
          that.emit(':ask', output);
        } else {
          that.emit(':tell', "I did't find any experts for this datetime.");
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
        getRestaurantsNearbyJSON(this).then(function (response) {
          if ( response.results.length > 0 ) {
            that.attributes['restaurant'] = response.results[0];
            var restaurant = that.attributes['restaurant'].name;
            var display_date = dateFormat(that.attributes['date'], "dddd, mmmm dS");
            var temp = new Date (new Date().toDateString() + ' ' + that.attributes['time']);
            var display_time = dateFormat(temp, "shortTime");
            that.handler.state = states.ACCEPT_MEETING;
            that.emit(':ask', "Meeting with "+that.attributes['chosen_person_data'].first_name+" on "+display_date+" at "+display_time+" in "+restaurant+". Is that OK?");
          } else {
            that.emit(':tell', "I did't find any restaurants.");
          }
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

var acceptMeetingHandlers = Alexa.CreateStateHandler(states.ACCEPT_MEETING, {
    'AMAZON.YesIntent': function () {
        var that = this;
        postSetMeetingJSON(this).then(function (response) {
          output = "That's perfect! Invitation to meeting has been sent. We will inform you via SMS and email about confirmation or rejection.";
          that.emit(':tell', output);
        });
    },
    // 'AMAZON.NoIntent': function () {
    //     this.attributes['discarded_ids'].push(this.attributes['chosen_person_data'].id);
    //     output = "If you want me to find another person with the same skill, say 'next'. If you want to change the skill - say 'change skill for' and the name of the skill.";
    //     this.emit(':ask', output, output);
    // },
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
        var output = "Invitation from "+ current_notification.meeting.user.first_name + " who is looking for "+current_notification.meeting.user.looking_for +". Meeting took place in "+current_notification.meeting.location+" at "+ dateFormat(current_notification.meeting.when, "dddd, mmmm dS, yyyy, h:MM:ss TT") +". Confirm, reject, next invitation, or pass to looking for a lunch?";
        this.emit(':ask', output);
      } else {
        this.handler.state = states.CHOOSE_ABILITY;
        var output = "No more waiting invitations. You're looking for a person with what skill?";
        this.emit(':ask', output);
      }
    },
    'AMAZON.YesIntent': function () {
        var current_notification = this.attributes['unconfirmed_notifications'][this.attributes['current_notification']];
        var output = "Invitation from "+ current_notification.meeting.user.first_name + " who is looking for "+current_notification.meeting.user.looking_for +". Meeting took place in "+current_notification.meeting.location+" at "+ dateFormat(current_notification.meeting.when, "dddd, mmmm dS, yyyy, h:MM:ss TT")+". Confirm, reject, next invitation, or pass to looking for a lunch?";
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
          if (that.attributes['current_notification'] >= that.attributes['unconfirmed_notifications'].length) {
            that.handler.state = states.CHOOSE_ABILITY;
            output = output + "No more waiting invitations. You're looking for a person with what skill?";
            that.emit(':ask', output);
          } else {
            var current_notification = that.attributes['unconfirmed_notifications'][that.attributes['current_notification']];
            that.attributes['current_notification'] = that.attributes['current_notification'] + 1;
            output = output + "Invitation from "+ current_notification.meeting.user.first_name + ". Confirm, reject, next invitation, or pass to looking for a lunch?";
            that.emit(':ask', output);
          }
        });
    },
    'rejectInvitation': function () {
        var that = this;
        postRejectInvitaionJSON(this).then(function (response) {
          var output = "Meeting successfully rejected.";
          that.attributes['current_notification'] = that.attributes['current_notification'] + 1;
          if (that.attributes['current_notification'] >= that.attributes['unconfirmed_notifications'].length) {
            that.handler.state = states.CHOOSE_ABILITY;
            output = output + "No more waiting invitations. You're looking for a person with what skill?";
            that.emit(':ask', output);
          } else {
            var current_notification = that.attributes['unconfirmed_notifications'][that.attributes['current_notification']];
            that.attributes['current_notification'] = that.attributes['current_notification'] + 1;
            output = output + "Invitation from "+ current_notification.meeting.user.first_name + ". Confirm, reject, next invitation, or pass to looking for a lunch?";
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
    alexa.registerHandlers(newSessionHandlers, startGetUsersHandlers, notificationsHandlers, setDateTimeMeetingHandlers, acceptMeetingHandlers);
    alexa.execute();
};

function getJSON(that) {

    var options = {
        uri: "https://hidden-beach-26730.herokuapp.com/api/with_ability.json",
        qs: {
            ability_name: that.attributes['ability_name'],
            discarded_ids: that.attributes['discarded_ids'],
            current_user_id: that.attributes['current_user_id'],
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
          meeting_id: that.attributes['unconfirmed_notifications'][that.attributes['current_notification']].meeting.id
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
          meeting_id: that.attributes['unconfirmed_notifications'][that.attributes['current_notification']].meeting.id
      },
      json: true // Automatically stringifies the body to JSON
    };

    return rq(options);
}

function getUsersDeadlineJSON(that) {

    var options = {
        uri: "https://hidden-beach-26730.herokuapp.com/api/with_ability_and_datetime.json",
        qs: {
            ability_name: that.attributes['ability_name'],
            discarded_ids: that.attributes['discarded_ids'],
            current_user_id: that.attributes['current_user_id'],
            day_number: that.attributes['day_number'],
            time: that.attributes['time'],
        },
        json: true
    };

    return rq(options);
}

function getRestaurantsNearbyJSON(that) {
  var options = {
        uri: "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        qs: {
            location: that.attributes['chosen_person_data'].latitude+","+that.attributes['chosen_person_data'].longitude,
            radius: 500,
            type: 'restaurant',
            key: 'AIzaSyAG7rci1mcpe_MPiatVAgPP9kk-VlIG6mc'
        },
        json: true
    };

    return rq(options);
}

function postSetMeetingJSON(that) {

    var options = {
      method: 'POST',
      uri: "https://hidden-beach-26730.herokuapp.com/api/set_meeting",
      body: {
          invitor_id: that.attributes['current_user_id'],
          invited_id: that.attributes['chosen_person_data'].id,
          location: (that.attributes['restaurant'].name +", "+ that.attributes['restaurant'].vicinity),
          date: that.attributes['date'],
          time: that.attributes['time'],
      },
      json: true // Automatically stringifies the body to JSON
    };

    return rq(options);
}
