'use strict';
var Alexa = require('alexa-sdk');
var request = require("request");
var rq = require("request-promise");

var states = {
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
        this.attributes['discarded_ids'] = [];
        this.handler.state = states.CHOOSE_ABILITY;
        output = welcomeMessage;
        this.emit(':ask', output, welcomeRepromt);
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
        output = "That's perfect! Meeting with "+this.attributes['chosen_person_data'].first_name;
        this.emit(':tell', output);
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

exports.handler = function (event, context, callback) {
    alexa = Alexa.handler(event, context);
    alexa.registerHandlers(newSessionHandlers, startGetUsersHandlers);
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
