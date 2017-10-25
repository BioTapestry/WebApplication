var profile = (function(){
    var copyOnly = function(filename, mid){
            var list = {
            	"expdata/expdata.profile": true,
                "expdata/expdata.profile.js": true,
                "expdata/package.json": true,
                "expdata/start": true
            };
            return (mid in list) ||
                (/^expdata\/resources\//.test(mid)
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