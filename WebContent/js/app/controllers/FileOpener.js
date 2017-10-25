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
    "dojo/Deferred",
    "static/XhrUris",
    "dialogs/DialogDefinitions",
    "controllers/XhrController"
],function(
	Deferred,
	XhrUris,
	DialogDefs,
	xhrController
){
	
	var asyncLoader = null;
	
	var fileChooserDialog = null;
	
	function _getFileList() {
		asyncLoader = new Deferred();
		xhrController.xhrRequest(XhrUris.filelist).then(function(response){
			asyncLoader.resolve(response);
		},function(err){
			if(err.status === "NEW_SESSION") {
				require(["controllers/ActionCollection"],function(ActionCollection){
					ActionCollection.CLIENT_WARN_RESTART_SESSION();
				});
			}
		});
		return asyncLoader.promise;
	};
	
	function _buildDialog() {
		var builder = new Deferred();
		_getFileList().then(function(filelist){
			require(["dialogs/DialogFactory"],function(DialogFactory){
				fileChooserDialog = DialogFactory.makeFileChooserDialog({
					fileList: filelist.files, 
					isModal: true, 
					title: "Select a Model File",
					defName: "FILE_CHOOSER"
				});
				builder.resolve();				
			});
		});
		return builder.promise;
	};
	
	return {
		chooseFile: function() {
			_buildDialog().then(function(){
				fileChooserDialog.show();
			});
		},
		openFile: function(fileNames) {
			if(fileNames) {
				var filename = null;
				for(var i in fileNames) {
					if(fileNames.hasOwnProperty(i)) {
						// Eventually this would form a concatenated list
						filename = fileNames[i].fileName;
					}
				}
				xhrController.xhrRequest(XhrUris.openfile(filename),{method: "POST"}).then(function(response){
					alert("File opened: " + response.file);
				},function(err){
					if(err.status === "NEW_SESSION") {
						require(["controllers/ActionCollection"],function(ActionCollection){
							ActionCollection.CLIENT_WARN_RESTART_SESSION();
						});
					}
				});
			}
		}
	};
});