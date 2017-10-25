define([

], function() {
    return {
        createCanvasElement: function(width, height, args) {
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            for (key in args) {
                if (args.hasOwnProperty(key)) {
                    canvas[key] = args[key];
                }
            }

            return canvas;
        }
    };
});
