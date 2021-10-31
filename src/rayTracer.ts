// classes you may find useful.  Feel free to change them if you don't like the way
// they are set up.

//import { Ray } from "three";
import { degToRad } from "three/src/math/MathUtils";

export class Vector {
    constructor(public x: number,
                public y: number,
                public z: number) {
    }
    static times(k: number, v: Vector) { return new Vector(k * v.x, k * v.y, k * v.z); }
    static minus(v1: Vector, v2: Vector) { return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z); }
    static plus(v1: Vector, v2: Vector) { return new Vector(v1.x + v2.x, v1.y + v2.y, v1.z + v2.z); }
    static dot(v1: Vector, v2: Vector) { return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z; }
    static mag(v: Vector) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); }
    static norm(v: Vector) {
        var mag = Vector.mag(v);
        var div = (mag === 0) ? Infinity : 1.0 / mag;
        return Vector.times(div, v);
    }
    static cross(v1: Vector, v2: Vector) {
        return new Vector(v1.y * v2.z - v1.z * v2.y,
                          v1.z * v2.x - v1.x * v2.z,
                          v1.x * v2.y - v1.y * v2.x);
    }
}

export class Color {
    constructor(public r: number,
                public g: number,
                public b: number) {
    }
    static scale(k: number, v: Color) { return new Color(k * v.r, k * v.g, k * v.b); }
    static plus(v1: Color, v2: Color) { return new Color(v1.r + v2.r, v1.g + v2.g, v1.b + v2.b); }
    static times(v1: Color, v2: Color) { return new Color(v1.r * v2.r, v1.g * v2.g, v1.b * v2.b); }
    static white = new Color(1.0, 1.0, 1.0);
    static grey = new Color(0.5, 0.5, 0.5);
    static black = new Color(0.0, 0.0, 0.0);
    static toDrawingColor(c: Color) {
        var legalize = (d: number) => d > 1 ? 1 : d;
        return {
            r: Math.floor(legalize(c.r) * 255),
            g: Math.floor(legalize(c.g) * 255),
            b: Math.floor(legalize(c.b) * 255)
        }
    }
}

class Sphere {
    radius: number;
    center: Vector;
    kd: Color;
    ka: number; //k_ambient
    ks: number; //k_specular
    specular_pow: number; //pi

    constructor(r: number, center: Vector, kd: Color, 
        k_ambient: number, k_specular: number, specular_pow: number) {
        this.radius = r;
        this.center = center;
        this.kd = kd
        this.ka = k_ambient;
        this.ks = k_specular;
        this.specular_pow = specular_pow;
    }

    collide(ray: Ray): number {
        let d = ray.dir
        let c = this.center
        let e = ray.start
        let R = this.radius
        //(d⋅(e−c))2−(d⋅d)((e−c)⋅(e−c)−R2)
        let e_c = Vector.minus(e,c)      
        let b = Vector.dot(d, e_c)
        let delta = b * b - Vector.dot(d, d)* (Vector.dot(e_c, e_c) - R*R)
        if (delta < 0) {
            return NaN;
        }
        let t1 = (-b + Math.sqrt(delta)) / Vector.dot(d, d)
        let t2 = (-b - Math.sqrt(delta)) / Vector.dot(d, d)
        if (t1 < 0 && t2 < 0) {return NaN;}
        else if (t1 > 0 && t2 > 0) {return Math.min(t1, t2);}
        else {return Math.max(t1, t2);}
    }

    getColor(t: number, ray: Ray, lights: Light[], Ia: Color): Color {
        let pos = Vector.plus(ray.start,Vector.times(t, ray.dir))
        let N = Vector.norm(Vector.minus(pos, this.center))
        let V = Vector.norm(Vector.minus(ray.start,pos))
        let sum = new Color(0,0,0)
        lights.forEach(light => {
            let Li = Vector.norm(Vector.minus(light.pos, pos))
            //2 * N . L * N - L
            let Ri = Vector.norm(Vector.minus(Vector.times(2*Vector.dot(N, Li), N), Li))
            let diffuseTerm = Vector.dot(N, Li) < 0? new Color(0,0,0): 
                                Color.scale(Vector.dot(N, Li), Color.times(light.color, this.kd))
            //console.log(Vector.dot(Ri, V), this.specular_pow) 
            let specularTerm = Vector.dot(Ri, V) < 0? new Color(0,0,0): 
                                Color.scale(this.ks * Math.pow(Vector.dot(Ri, V), this.specular_pow), light.color) 
            //console.log(Vector.dot(Ri, V), " * ", this.ks, " * ", light.color, " = ", specularTerm, sum)
            sum = Color.plus(sum, diffuseTerm)
            sum = Color.plus(sum, specularTerm)
            console.log("= ", sum)
        });
        sum = Color.plus(sum, Color.times(Color.scale(this.ka, Ia), this.kd))
        //console.log(sum)
        return sum;
    }
}
    

interface Ray {
    start: Vector;
    dir: Vector;
}

interface Light {
    pos: Vector,
    color: Color
}


// A class for our application state and functionality
class RayTracer {
    // the constructor paramater "canv" is automatically created 
    // as a property because the parameter is marked "public" in the 
    // constructor parameter
    // canv: HTMLCanvasElement
    //
    // rendering context for the canvas, also public
    // ctx: CanvasRenderingContext2D

    // initial color we'll use for the canvas
    canvasColor = "lightyellow"
    backgroundColor = new Color(0, 0, 0) //init to black
    
    //new class variables 
    spheres: Sphere[] = [];
    cameraPos: Vector = new Vector(0,0,0); 
    lookAtVec: Vector = new Vector(0,0,1);  
    upVec: Vector = new Vector(0,1,0); 
    fov: number = 90 //in degree

    Ia: Color = new Color(0,0,0); //ambient light color
    lights: Light[] = [];

    canv: HTMLCanvasElement
    ctx: CanvasRenderingContext2D 

    // div is the HTMLElement we'll add our canvas to
    // width, height are the size of the canvas
    // screenWidth, screenHeight are the number of pixels you want to ray trace
    //  (recommend that width and height are multiples of screenWidth and screenHeight)
    constructor (div: HTMLElement,
        public width: number, public height: number, 
        public screenWidth: number, public screenHeight: number) {

        // let's create a canvas and to draw in
        this.canv = document.createElement("canvas");
        this.ctx = this.canv.getContext("2d")!;
        if (!this.ctx) {
            console.warn("our drawing element does not have a 2d drawing context")
            return
        }
 
        div.appendChild(this.canv);

        this.canv.id = "main";
        this.canv.style.width = this.width.toString() + "px";
        this.canv.style.height = this.height.toString() + "px";
        this.canv.width  = this.width;
        this.canv.height = this.height;
    }

    // API Functions you should implement

    // clear out all scene contents
    reset_scene() {
        this.set_fov(90);
        this.set_eye(0,0,0, 0,0,-1, 0,1,0)
        this.spheres = []
        this.lights = []
        this.Ia = Color.black
    }

    // create a new point light source
    new_light (r: number, g: number, b: number, x: number, y: number, z: number) {
        let lightCnt = this.lights.length
        let currLight: Light = {
            pos: new Vector(x, y, z),
            color: new Color(r, g, b)
        };
        this.lights[lightCnt] = currLight;
    }

    // set value of ambient light source
    ambient_light (r: number, g: number, b: number) {
        this.Ia = new Color(r,g,b)
    }

    // set the background color for the scene
    set_background (r: number, g: number, b: number) {
        this.backgroundColor = new Color(r, g, b);
    }

    // set the field of view
    DEG2RAD = (Math.PI/180)
    set_fov (theta: number) {
        this.fov = theta
    }

    // set the virtual camera's position and orientation
    // x1,y1,z1 are the camera position
    // x2,y2,z2 are the lookat position
    // x3,y3,z3 are the up vector
    set_eye(x1: number, y1: number, z1: number, 
            x2: number, y2: number, z2: number, 
            x3: number, y3: number, z3: number) {
                this.cameraPos = new Vector(x1, y1, z1) 
                let lookUpPos = new Vector(x2, y2, z2)
                this.lookAtVec = Vector.norm(Vector.minus(this.cameraPos, lookUpPos))
                this.upVec = Vector.norm(new Vector(x3, y3, z3))
    }

    // create a new sphere
    new_sphere (x: number, y: number, z: number, radius: number, 
                dr: number, dg: number, db: number, 
                k_ambient: number, k_specular: number, specular_pow: number) {
                    let spCnt = this.spheres.length
                    let sp = new Sphere(radius, new Vector(x,y,z), new Color(dr, dg, db), k_ambient, k_specular, specular_pow)
                    this.spheres[spCnt] = sp
    }

    // INTERNAL METHODS YOU MUST IMPLEMENT

    // create an eye ray based on the current pixel's position
    private eyeRay(i: number, j: number): Ray {
        let d = 1/Math.tan(this.fov*this.DEG2RAD/2)
        let us = -1 + 2*i/this.screenWidth // left to right
        let u = Vector.cross(this.upVec, this.lookAtVec) //y corss z = x
        let vs = 1 - 2*j/this.screenHeight * this.height/ this.width

        //console.log(this.lookAtVec, this.upVec)
        // -dW + usU + vsV
        let dw = Vector.times(-d, this.lookAtVec)
        let usU = Vector.times(us, u)
        let vsV = Vector.times(vs, this.upVec)
        let dir = Vector.plus(Vector.plus(dw, usU), vsV)
        //console.log(dir)
        let ray: Ray = {
            start: this.cameraPos,
            dir: Vector.norm(dir)
        };
        return ray 
    }

    private traceRay(ray: Ray, depth: number = 0): Color {
        if (this.spheres.length == 0) {
            return this.backgroundColor
        }
        var t = Number.MAX_VALUE;
        var sphereidx = -1;
        // find the closest valid time t
        for (let i = 0; i < this.spheres.length; i++) {
            let currsp = this.spheres[i];
            let time = currsp.collide(ray)
            //console.log(time)
            
            // iff collide
            if (!Number.isNaN(time)) {
                if (time < t) {
                    t = time;
                    sphereidx = i
                }
            }
        }
        return sphereidx < 0? this.backgroundColor: this.spheres[sphereidx].getColor(t, ray, this.lights, this.Ia)
    }

    // draw_scene is provided to create the image from the ray traced colors. 
    // 1. it renders 1 line at a time, and uses requestAnimationFrame(render) to schedule 
    //    the next line.  This causes the lines to be displayed as they are rendered.
    // 2. it uses the additional constructor parameters to allow it to render a  
    //    smaller # of pixels than the size of the canvas
    draw_scene() {

        // rather than doing a for loop for y, we're going to draw each line in
        // an animationRequestFrame callback, so we see them update 1 by 1
        var pixelWidth = this.width / this.screenWidth;
        var pixelHeight = this.height / this.screenHeight;
        var y = 0;
        
        this.clear_screen();

        var renderRow = () => {
            for (var x = 0; x < this.screenWidth; x++) {

                var ray = this.eyeRay(x, y);
                var c = this.traceRay(ray);

                var color = Color.toDrawingColor(c)
                this.ctx.fillStyle = "rgb(" + String(color.r) + ", " + String(color.g) + ", " + String(color.b) + ")";
                this.ctx.fillRect(x * pixelWidth, y * pixelHeight, pixelWidth+1, pixelHeight+1);
            }
            
            // finished the row, so increment row # and see if we are done
            y++;
            if (y < this.screenHeight) {
                // finished a line, do another
                requestAnimationFrame(renderRow);            
            } else {
                console.log("Finished rendering scene")
            }
        }

        renderRow();
    }

    clear_screen() {
        this.ctx.fillStyle = this.canvasColor;
        this.ctx.fillRect(0, 0, this.canv.width, this.canv.height);
    }
}
export {RayTracer}