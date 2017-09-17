
define(['d3', 'd3-geo', 'metr/io'], function(d3, d3geo, io) {

    var gui = function() {
        var _this = this;

        this.draw_order = [];

        this.init_map = function() {
            _this.map = d3.select('#main');
            _this.map.node().width = window.innerWidth;
            _this.map.node().height = window.innerHeight;

            _this.width = _this.map.node().width
            _this.height = _this.map.node().height

            _this.map.style('background-color', '#cccccc');

            _this.zoom_trans = d3.zoomTransform(_this.map.node())
                                 .translate(_this.width / 2, _this.height / 2);

            var parallels = [30, 45]
            var std_lon = -97.5
            var std_lat = 37.5

            _this.map_proj = d3geo.geoConicConformal()
                                  .parallels(parallels)
                                  .rotate([-std_lon, 0])
                                  .center([0, std_lat])
                                  .scale(1000)
                                  .translate([0, 0]);
            _this.p2e = 6371;

            _this.proj = {'stream':function(s) {
                return _this.map_proj.stream(_this._gt_from_zt(_this.zoom_trans).stream(s));
            }};

//          console.log(d3geo.geoPath(_this.proj)({'type':'Point', 'coordinates':[-97.5, 37.5]}));

            io.download_shape('/geo/us_cty.json', function(shp_file) {
                _this.add_shape('US Counties', shp_file);

                window.addEventListener('resize', function() {
                    _this.map.node().width = window.innerWidth;
                    _this.map.node().height = window.innerHeight;
                    _this.width = _this.map.node().width
                    _this.height = _this.map.node().height

                    // This has some interesting behavior when resizing while zoomed in ...
                    var zt = d3.zoomTransform(_this.map.node());
                    zt = zt.translate(_this.width / 2, _this.height / 2)
                    _this.zoom_trans = zt;
                    _this.draw();
                });
                _this.map.call(d3.zoom().scaleExtent([0.5, 120]).on("zoom", _this.zoom))
            });

            io.download_88d_list(function(wsrdf) {
                _this.wsr88ds = wsrdf;
            });

            io.download_level2('KCRP', new Date(2017, 8, 26, 2, 53), 'REF', 0.5, function(l2_file) {
                _this.add_level2('KCRP 0.5-degree reflectivity', l2_file);
            });
        };

        this.zoom = function() {
            _this.zoom_trans = d3.event.transform.translate(_this.width / 2, _this.height / 2);
            _this.draw();
        };

        this.draw = function () {
            var ctx = _this.map.node().getContext('2d');
            ctx.clearRect(0, 0, _this.width, _this.height);

            for (ilyr in _this.draw_order) {
                _this.draw_order[ilyr].draw();
            }
        };

        this.add_shape = function(shp_name, shp_file) {
            var ctx = _this.map.node().getContext('2d');
            ctx.strokeStyle = 'black';
//          ctx.lineWidth = 0.5;

            proj_data = [];
            for (ishp in shp_file.data) {
                proj_data[ishp] = [];
                for (ipt in shp_file.data[ishp]) {
                    proj_data[ishp][ipt] = _this.map_proj(shp_file.data[ishp][ipt]);
                }
            }

            _this.draw_order.push({'name':shp_name, 'draw':function() {
                zoom = _this._gt_from_zt(_this.zoom_trans);
                path = d3geo.geoPath(zoom, ctx);
                ctx.beginPath();
                path({'type': 'MultiLineString', 'coordinates':proj_data});
                ctx.stroke();
            }})

            _this.draw();
        };

        this.add_level2 = function(level2_name, l2_file) {
            var ctx = _this.map.node().getContext('2d');
            var site_info;
            for (i88d in _this.wsr88ds) {
                if (_this.wsr88ds[i88d].id == l2_file.site) {
                    site_info = _this.wsr88ds[i88d];
                    break;
                }
            }

            console.log(l2_file);
            var st_az = l2_file.st_azimuth;
            var st_rn = l2_file.st_range;
            var dazim;
            var drng = 250;
            if (l2_file.n_rays == 720) {
                dazim = 0.5;
            }
            else {
                dazim = 1.0;
            }

            _this.draw_order.unshift({'name':level2_name, 'draw':function() {
                var rdr_loc = _this.map_proj([site_info.longitude, site_info.latitude]);
                var rdr_px = _this.zoom_trans.apply(rdr_loc);

                var scimg = ctx.createImageData(_this.width, _this.height);
                var scimg_data = scimg.data;
                var printed = false;
                for (var xpx = 0; xpx < _this.width; xpx++) {
                    for (var ypx = 0; ypx < _this.height; ypx++) {
                        var xrdr = xpx - rdr_px[0];
                        var yrdr = ypx - rdr_px[1];
                        var rng = Math.sqrt(xrdr * xrdr + yrdr * yrdr) / _this.zoom_trans.k;
                        var rng_earth = rng * _this.p2e;
                        var scidx = (ypx * _this.width + xpx) * 4;
                        if (rng_earth >= st_rn - drng / 2 && rng_earth <= drng * l2_file.n_gates + drng / 2) {
                            var azm = 90 + Math.atan2(yrdr, xrdr) * 180 / Math.PI;
                            if (azm < 0) { azm += 360; }

                            var iaz = azm - st_az;
                            if (iaz < 0) { iaz += 360; }
                            if (iaz > 360) { iaz -= 360; }
                            iaz = Math.round(iaz / dazim);

                            var irn = Math.round((rng_earth - st_rn) / drng);
                            var igt = l2_file.n_gates * iaz + irn;
                            var rdat = l2_file.data[igt];
                            var rcolor = _this._reflectivity_color_map(rdat);
                            scimg_data[scidx + 0] = rcolor[0];
                            scimg_data[scidx + 1] = rcolor[1];
                            scimg_data[scidx + 2] = rcolor[2];
                            scimg_data[scidx + 3] = rcolor[3];
                        }
                    }
                }
//              ctx.putImageData(scimg, 0, 0);
            }});
            _this.draw();
        };

        this._gt_from_zt = function(zt) {
            return d3geo.geoTransform({
                'point':function(x, y) {
                    trans_pt = zt.apply([x, y]);
                    this.stream.point(trans_pt[0], trans_pt[1]);
                }
            });
        }

        this._reflectivity_color_map = function(ref) {
            var color;
            if (ref < 5) { color = [0, 0, 0, 0]; }
            else if (ref >= 5  && ref < 10) { color = [0,   236, 236, 255]; }
            else if (ref >= 10 && ref < 15) { color = [1,   160, 246, 255]; }
            else if (ref >= 15 && ref < 20) { color = [0,   255, 246, 255]; }
            else if (ref >= 20 && ref < 25) { color = [0,   200, 0,   255]; }
            else if (ref >= 25 && ref < 30) { color = [0,   144, 0,   255]; }
            else if (ref >= 30 && ref < 35) { color = [255, 255, 0,   255]; }
            else if (ref >= 35 && ref < 40) { color = [243, 192, 0,   255]; }
            else if (ref >= 40 && ref < 45) { color = [255, 144, 0,   255]; }
            else if (ref >= 45 && ref < 50) { color = [255, 0,   0,   255]; }
            else if (ref >= 50 && ref < 55) { color = [214, 0,   0,   255]; }
            else if (ref >= 55 && ref < 60) { color = [192, 0,   0,   255]; }
            else if (ref >= 60 && ref < 65) { color = [255, 0,   255, 255]; }
            else if (ref >= 65 && ref < 70) { color = [153, 85,  201, 255]; }
            else if (ref >= 70 && ref < 75) { color = [0,   0,   0,   255]; }
            else { color = [0, 0, 0, 0]; }
            return color;
        }
    };
    return new gui()
})
