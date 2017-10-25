define([
    "dojo/topic"
    ,"utils"
    ,"dojo/domReady!"
],function(
	topic
	,utils
){
	
	
	
	var _metaSettings = {};
	
	
	
	var _subscriptions = {};
	
	
	
	return {
		watchForSetting: function(subTopic,callback) {
			if(!_metaSettings[subTopic]) {
				return null;
			}
			var subId = "sub_"+utils.makeId();
			_subscriptions[subId] = topic.subscribe(subTopic,callback);
			return subId;
		},
		removeWatch: function(id) {
			_subscriptions[id].remove();
		}
	};
});