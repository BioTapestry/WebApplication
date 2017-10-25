var profile = (function(){
    var copyOnly = function(filename, mid){
            var list = {
            	"pathing/pathing.profile": true,
                "pathing/pathing.profile.js": true,
                "pathing/package.json": true,
                "pathing/start": true
            };
            return (mid in list) ||
                (/^pathing\/resources\//.test(mid)
                    && !/\.css$/.test(filename)) ||
                /(png|jpg|jpeg|gif|tiff)$/.test(filename);
            // Check if it is one of the special files, if it is in
            // app/resource (but not CSS) or is an image
        };
 
    return {
    	resourceTags: {

            copyOnly: function(filename, mid){
                return copyOnly(filename, mid);
                // Tag our copy only files
            },

            amd: function(filename, mid){
                return !copyOnly(filename, mid)
                    && /\.js$/.test(filename);
                // If it isn't a test resource, copy only,
                // but is a .js file, tag it as AMD
            }
        }
    };
})();