
define(function() {
    var geo = function() {
        this.lcc = lcc;
        this.geodesic = geodesic;
    };

    var lcc = function(lon_0, lat_0, lat_1, lat_2) {
        this.set_parameters(lon_0, lat_0, lat_1, lat_2);
        this._geodesic = new geodesic();
    };

    lcc.prototype.set_parameters = function(lon_0, lat_0, lat_1, lat_2) {
        this.lon_0 = lon_0 * Math.PI / 180;
        this.lat_0 = lat_0 * Math.PI / 180;
        this.lat_1 = lat_1 * Math.PI / 180;
        this.lat_2 = lat_2 * Math.PI / 180;

        if (this.lat_1 == this.lat_2) {
            this.n = Math.sin(this.lat_1);
        }
        else {
            this.n = Math.log(Math.cos(this.lat_1) / Math.cos(this.lat_2)) 
                / Math.log(Math.tan(Math.PI / 4 + this.lat_2 / 2) / Math.tan(Math.PI / 4 + this.lat_1 / 2));
        }
        this.F = Math.cos(this.lat_1) * Math.pow(Math.tan(Math.PI / 4 + this.lat_1 / 2), this.n) / this.n;
        this.rho_0 = this.F / Math.pow(Math.tan(Math.PI / 4 + this.lat_0 / 2), this.n);
    };

    lcc.prototype.map = function(coord) {
        var lon = coord[0] * Math.PI / 180;
        var lat = coord[1] * Math.PI / 180;

        var rho = this.F / Math.pow(Math.tan(Math.PI / 4 + lat / 2), this.n);
        var arg = this.n * (lon - this.lon_0)

        var x = 1000 * rho * Math.sin(arg);
        var y = -1000 * (this.rho_0 - rho * Math.cos(arg));

        return [x, y];
    };

    lcc.prototype.rotate_vec = function(vec, coord) {
        var brg = Math.atan2(vec[1], vec[0]) * 180 / Math.PI - 90;
        var dst = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1]);
        other = this._geodesic.lonlat_at(coord, 0.001, brg);

        var pos_proj = this.map(coord);
        var other_proj = this.map(other);

        var residual = [other_proj[0] - pos_proj[0], other_proj[1] - pos_proj[1]];
        var residual_len = Math.sqrt(residual[0] * residual[0] + residual[1] * residual[1]);
        return [ dst * residual[0] / residual_len, dst * residual[1] / residual_len ];
    };

    lcc.prototype.setup_render = function(shader_prog) {
        shader_prog.bind_uniform('u_lcc_lon0', this.lon_0);
        shader_prog.bind_uniform('u_lcc_n', this.n);
        shader_prog.bind_uniform('u_lcc_F', this.F);
        shader_prog.bind_uniform('u_lcc_rho0', this.rho_0);
        shader_prog.bind_uniform('u_scale', 1000);
    };

    lcc.prototype.setup_shader = function(shader_prog) {
        shader_prog.register_uniform('float', 'u_lcc_lon0');
        shader_prog.register_uniform('float', 'u_lcc_n');
        shader_prog.register_uniform('float', 'u_lcc_F');
        shader_prog.register_uniform('float', 'u_lcc_rho0');
        shader_prog.register_uniform('float', 'u_scale');
    };

    lcc.prototype.shader = function() {
        var shader = `
            uniform float u_lcc_lon0;
            uniform float u_lcc_n;
            uniform float u_lcc_F;
            uniform float u_lcc_rho0;
            uniform float u_scale;

            #define M_PI 3.1415926535897932384626433832795

            vec2 lcc(vec2 coord) {
                float lat = radians(coord.y);
                float lon = radians(coord.x);

                float lcc_rho = u_lcc_F / pow(tan(M_PI / 4. + lat / 2.), u_lcc_n);
                float arg = u_lcc_n * (lon - u_lcc_lon0);

                return u_scale * (vec2(0., -u_lcc_rho0) + lcc_rho * vec2(sin(arg), cos(arg)));
            }

            vec2 rotate_vec(vec2 vector, vec2 coord) {
                float brg = degrees(atan(-vector.y, vector.x)) + 90.;
                float dst = length(vector);
                vec2 other = lonlat_at(coord, 1., brg);

                return dst * vec2(1., -1.) * normalize(lcc(other) - lcc(coord));
            }

        `;
        return shader;
    };

    var geodesic = function() {
        this.r_earth = 6371.
    };

    geodesic.prototype.gc_distance = function(lon1, lat1, lon2, lat2) {

    };

    geodesic.prototype.lonlat_at = function(start, dst, brg) {
        var lon1 = start[0] * Math.PI / 180;
        var lat1 = start[1] * Math.PI / 180;
        var brgr = brg * Math.PI / 180;
        var dstr = dst / this.r_earth;

        var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dstr) + Math.cos(lat1) * Math.sin(dstr) * Math.cos(brgr));
        var lon2 = lon1 + Math.atan2(Math.sin(brgr) * Math.sin(dstr) * Math.cos(lat1), Math.cos(dstr) - Math.sin(lat1) * Math.sin(lat2));
        lon2 = ((lon2 + 3. * Math.PI) % (2. * Math.PI)) - Math.PI;
        return [lon2 * 180 / Math.PI, lat2 * 180 / Math.PI];
    };

    geodesic.prototype.setup_render = function() {};
    geodesic.prototype.setup_shader = function() {};

    geodesic.prototype.shader = function() {
        var shader = `
            #define M_RE 6371.
            #define M_PI 3.1415926535897932384626433832795
/*
            vec3 norm_from_lonlat(vec2 lonlat) {
                return vec3(cos(radians(lonlat.y)) * cos(radians(lonlat.x)), 
                            cos(radians(lonlat.y)) * sin(radians(lonlat.x)), 
                            sin(radians(lonlat.y)));
            }

            float gc_distance(vec2 start, vec2 end) {
                vec3 start_norm = norm_from_lonlat(start);
                vec3 end_norm = norm_from_lonlat(end);
                return M_RE * atan(length(cross(start_norm, end_norm)), dot(start_norm, end_norm));
            }
*/
            vec2 lonlat_at(vec2 start, float dst, float brg) {
                float lon1 = radians(start.x);
                float lat1 = radians(start.y);
                float brgr = radians(brg);
                float dstr = dst / M_RE;

                float lat2 = asin(sin(lat1) * cos(dstr) + cos(lat1) * sin(dstr) * cos(brgr));
                float lon2 = lon1 + atan(sin(brgr) * sin(dstr) * cos(lat1), cos(dstr) - sin(lat1) * sin(lat2));
                lon2 = mod(lon2 + 3. * M_PI, 2. * M_PI) - M_PI;
                return vec2(degrees(lon2), degrees(lat2));
            }

        `;
        return shader;
    };

    return new geo()
})
