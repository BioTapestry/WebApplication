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


////////////////////////////////////////////
// FileUploader.js
////////////////////////////////////////////
//
// Dojo Module for creating 'File>Open' style functionality on a webpage
//
// Due to how the DOM, form elements, and input elements interact with Javascript,
// this module *MUST* be loaded at the time its containing menubar Module/Widget
// is loaded, otherwise the .click() event for the file input element may
// not function in Chrome the first time it is used.


define([
    "dojo/dom-construct",
    "dojo/on",
    "dojo/_base/declare",
    "dojo/dom",
    "dijit/form/Form",
    "dojo/Deferred",
    "static/XhrUris",
    "dojo/domReady!"
],function(
	domConstruct,
	on,
	declare,
	dom,
	Form,
	Deferred,
	XhrUris
) {
	
	var asyncBuilder = new Deferred();
	
	var LARGEST_FILE_SIZE = 4096000;
	
	var uploadInProgress = false;
	
	var gettingFile = false;
	
	var hMenu = dom.byId("horizontal_menu_widget");
	
	var formDiv = domConstruct.create("div",{
		style: "display: none;"
	},hMenu,"last");
	
    var form = new Form({
    	id: "file_uploader",
    	action: XhrUris.uploadFile,
    	method: "POST",
    	encType: "multipart/form-data",
    	encoding: "multipart/form-data",
    	style: "display: none;"
    },formDiv);	
    
    var fileInput = {
    	input: null,
    	handler: null
    };
	
	// If we are sending files to the server, we don't want to
	// send more than a certain size
	var checkFileUploadSize = function() {
		if(fileInput) {
			if(fileInput.input.files[0].size > LARGEST_FILE_SIZE) {
				alert("The largest file you can upload is 4MB in size!");
				
				// You can't clear out the input field because security,
				// but you *can* delete it and remake it.

				makeFileInput();
				
				return false;
			}
			return true;
		}
		return false;
	};    
	
	var uploadFile = function() {
		console.debug("upload file!");
		require(["dojo/request/iframe"], function(iframe){
			iframe.post(XhrUris.upload,{
				form: dom.byId("file_uploader"),
			    handleAs: "json"
			}).then(function(data){
				if(data.status) {
					require(["dialogs/BTDialog","dialogs/DialogDefinitions"],function(BTDialog,DialogDefs) {
						DialogDefs.addDialogDef(
							"ERROR_FILEUPLOAD",
							DialogDefs.makeBasicErrorDef(data.errormsg,"Error Uploading File","ERROR_FILEUPLOAD")
						);
						var errDialog = new BTDialog("ERROR_FILEUPLOAD",null,true);
						errDialog.show();
					});
				} else {
					// Stuff
				}
				
				
				uploadInProgress = false;

				makeFileInput();				
				// Do something
			}, function(err){
				// Handle Error
				alert(err.errormsg);
				uploadInProgress = false;
				makeFileInput();	
			});
		});
	};
    
	
	var makeFileInput = function() {
				
		fileInput && fileInput.handler && fileInput.handler.remove();
		fileInput && fileInput.input && domConstruct.destroy(fileInput.input);
		
		fileInput.input = domConstruct.create("input",{
	    	type: "file",
	    	name: "datafile",
	    	id: "open",
	    	enctype: "multipart/form-data"
	    });
								
		fileInput.handler = on(fileInput.input,"change",function(e){
	    	if(checkFileUploadSize()) {
	    		if(!uploadInProgress) {
	    			uploadInProgress = true;
	    			uploadFile();
	    		}
	    	}
	    });	
						
		form.domNode.appendChild(fileInput.input);
		form.startup();
		
		asyncBuilder.resolve();

	};
	
	makeFileInput();

	return {
		getFile: function() {
			// use gettingFile to prevent double-firing of the event
			if(!gettingFile) {
				gettingFile = true;
				asyncBuilder.promise.then(function(){
					fileInput.input.click();
					gettingFile = false;
				});
			}
		}
	};
	
	
	
	
});