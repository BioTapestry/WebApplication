/*
**    Copyright (C) 2003-2014 Institute for Systems Biology 
**                            Seattle, Washington, USA. 
**
**    This library is free software; you can redistribute it and/or
**    modify it under the terms of the GNU Lesser General Public
**    License as published by the Free Software Foundation; either
**    version 2.1 of the License, or (at your option) any later version.
**
**    This library is distributed in the hope that it will be useful,
**    but WITHOUT ANY WARRANTY; without even the implied warranty of
**    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
**    Lesser General Public License for more details.
**
**    You should have received a copy of the GNU Lesser General Public
**    License along with this library; if not, write to the Free Software
**    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/

define([
    "dojo/Stateful",
    "dojo/_base/array",
    "dojo/_base/declare",
    "dojo/domReady!"
],function(
	Stateful,
	DojoArray,
	declare
){
	
	var grnMessageStore = [null,null];
	
	
	var GrnMessage = declare([Stateful],{
		message_: null,
		_message_Setter: function(val) {
			this.message_ = val;
		},
		_message_Getter: function() {
			return this.message_;
		},
		
		setMessageWatch: function(watchCallback) {
			return this.watch("message_",watchCallback);
		},
		
		constructor: function(msg) {
			this.set("message_",msg);
		}
	});
	

	var fixedMsgIndicies = {
		MODEL: 0,
		MODULE: 1
	};
	
	var modelMessage = new GrnMessage("");
		
	var modelMessageMap = {};
	
	function _setModelMessage() {
		var msgObj = (grnMessageStore[grnMessageStore.length-1] || grnMessageStore[fixedMsgIndicies.MODULE] || grnMessageStore[fixedMsgIndicies.MODEL] || {msg: ""});
		modelMessage.set("message_",msgObj.msg);		
	};
	
	return {
		
		/////////////////////////////////
		// setMessageWatch
		/////////////////////////////////
		// 
		// Registers a callback for any time the message changes
		// 
		// 
		// @param watchCallback
		// 	
		setMessageWatch: function(watchCallback) {
			return modelMessage.setMessageWatch(watchCallback);
		},
		
		/////////////////////////////////
		// setMessage
		/////////////////////////////////
		// 
		// Allows for settings of 'fixed' messages, i.e. messages in the stack whose
		// positions are guaranteed
		// 
		// 
		// @param newMessage
		// 
		setMessage: function(newMessage,msgType) {
			grnMessageStore[fixedMsgIndicies[msgType]] = newMessage;
			// The newMessage could be null/undefined, if we are trying to blank out a message
			if(newMessage) {
				modelMessageMap[newMessage.id] = newMessage;
			}
			_setModelMessage();
		},
		
		//////////////////////////////////
		// setMessageSticky
		/////////////////////////////////
		// 
		// Sets a message to 'sticky' so that pop events will not effect it. Only one message 
		// can be sticky at a time, so if a previously top-level message is sticky, it will be 
		// unstickied and removed from the array and storage object.
		// 
		//
		// @param message Object containing the message {<msg: "text">, <id: "unique ID">} to be
		// set to sticky; if the message is not already in the map and array it will be added
		//
		setMessageSticky: function(message) {
			if(!modelMessageMap[message.id]) {
				// This setSticky might go through ahead of a push, due to timing with the hover,
				// so let's take care of getting the message in place.
				this.pushMessage(message);
			}
			modelMessageMap[message.id].sticky = true;
			if(grnMessageStore.length > Object.keys(fixedMsgIndicies).length+1 && grnMessageStore[grnMessageStore.length-2].sticky) {
				delete modelMessageMap[grnMessageStore.splice(grnMessageStore.length-2,1)[0].id];
			}
		},
		
		/////////////////////////////////
		// removeStickies
		/////////////////////////////////
		// 
		// Unsticky anything in the message store which is stickied (this should only be one item
		// but to be safe we traverse the whole array)
		// 
		removeStickies: function() {
			DojoArray.forEach(grnMessageStore,function(msg){
				if(msg) {
					msg.sticky = false;	
				}
			});			
		},
		
		////////////////////////
		// pushMessage
		////////////////////////
		// 
		// Pushes the supplied message object onto the message store array, making it the top-level
		// message for display. If the message is already present, it is set to the displayed
		// message but *not* re-added
		// 
		// @param message Object containing the message {<msg: "text">, <id: "unique ID">} to be 
		// pushed onto the message store array
		//
		pushMessage: function(message) {
			if(!modelMessageMap[message.id]) {
				modelMessageMap[message.id] = message;
				message.sticky = false;
				grnMessageStore.push(message);
			}
			_setModelMessage();
		},
		
		/////////////////////////////////
		// popMessage
		/////////////////////////////////
		// 
		// pops the top-level message object off the message-store array and sets the new
		// top-level to the message *if the top level message object is not sticky*. The 
		// popped message is also removed from the maintenance map.
		// 
		// If the top-level message is sticky, nothing happens.
		// If we are at the base level message, nothing happens.
		// 
		popMessage: function() {
			if(grnMessageStore.length > Object.keys(fixedMsgIndicies).length && !grnMessageStore[grnMessageStore.length-1].sticky) {
				var thisMsg = grnMessageStore.pop();
				delete modelMessageMap[thisMsg.id];
				_setModelMessage();
			}
		}
	};
	
});