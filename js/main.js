
requirejs.config({
    baseUrl: 'js/lib', 
    paths: {
        'metr': '../metr',
        'd3':'https://d3js.org/d3.v4.min',
        'd3-array':'https://d3js.org/d3-array.v1.min',
        'd3-geo':'https://d3js.org/d3-geo.v1.min',
    }
});

requirejs(['metr/io', 'metr/gui'], 
    function(io, gui) {
        var time = new Date(2017, 9, 1, 23, 6);
//      var url = io.download_level2('KRAX', time, 'REF', 0.5);

        gui.init_map();
    }   
)
