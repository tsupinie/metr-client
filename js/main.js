
requirejs.config({
    baseUrl: 'js/lib', 
    paths: {
        'metr': '../metr',
        'd3':'https://d3js.org/d3.v4.min',
        'd3-array':'https://d3js.org/d3-array.v1.min',
        'd3-geo':'https://d3js.org/d3-geo.v1',
    }
});

requirejs(['metr/gui'], 
    function(gui) {
        gui.init_map();
    }   
)
