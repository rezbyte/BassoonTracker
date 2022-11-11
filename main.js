function checkForUpdates() {
  if (document.location.href.indexOf("updateversion") < 0) {
    if (window.XMLHttpRequest) {
      const req = new XMLHttpRequest();
      req.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
          const version = this.responseText;
          if (version != versionNumber) {
            console.log("update available");
            const char = document.location.href.indexOf("?") > 0 ? "&" : "?";
            document.location.href =
              document.location.href + char + "updateversion=" + version;
          }
        }
      };
      req.open("GET", "version.txt?r=" + new Date().getTime(), true);
      req.send();
    }
  }
}

function enforceHTTPS() {
  // force HTTPS - it is needed for the Dropbox integration
  if (
    document.location.href.indexOf("stef.be") > 0 &&
    document.location.href.indexOf("https:") < 0
  ) {
    document.location.href = document.location.href.replace("http:", "https:");
  }
}

function crt() {
  p8Canvas = document.getElementById("canvas");
  canvas = p8Canvas.cloneNode(true);

  p8Canvas.name = "p8Canvas";
  canvas.name = "canvas";
  canvas.class = "";
  canvas.width = p8Canvas.clientWidth;
  canvas.height = p8Canvas.clientHeight;
  gl = canvas.getContext("webgl");

  function switchEffect() {
    if (p8Canvas.parentNode != null) {
      p8Canvas.parentNode.insertBefore(canvas, p8Canvas);
      //canvas.parentNode.removeChild(p8Canvas);
    } else {
      canvas.parentNode.insertBefore(p8Canvas, canvas);
      //p8Canvas.parentNode.removeChild(canvas);
    }
  }

  function onKeyDown_switch(event) {
    console.error("rr");
    event = event || window.event;
    var o = document.activeElement;
    if (!o || o == document.body || o.tagName == "canvas") {
      if ([16].indexOf(event.keyCode) > -1) {
        switchEffect();
      }
    }
  }
  window.addEventListener("keydown", onKeyDown_switch, false);

  if (gl) {
    switchEffect();

    function glresize() {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.uniform2f(
        gl.getUniformLocation(program, "u_canvasSize"),
        gl.canvas.width,
        gl.canvas.height
      );
    }

    window.addEventListener("load", glresize, false);
    window.addEventListener("resize", glresize, false);
    window.addEventListener("orientationchange", glresize, false);
    window.addEventListener("fullscreenchange", glresize, false);
    window.addEventListener("webkitfullscreenchange", glresize, false); //for itch.app

    function compileShader(gl, source, type) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var info = gl.getShaderInfoLog(shader);
        throw "could not compile shader:" + info;
      }
      return shader;
    }

    var vs_script = document.getElementById("some-vertex-shader");
    var vs = compileShader(gl, vs_script.text, gl.VERTEX_SHADER);
    var fs_script = document.getElementById("some-fragment-shader");
    var fs = compileShader(gl, fs_script.text, gl.FRAGMENT_SHADER);

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var info = gl.getProgramInfoLog(program);
      throw "shader program failed to link:" + info;
    }
    gl.useProgram(program);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform3f(
      gl.getUniformLocation(program, "u_canvasSize"),
      gl.canvas.width,
      gl.canvas.height,
      0.0
    );

    var texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    var positionLocation = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([1, 1, -1, 1, -1, -1, -1, -1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    function gldraw() {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        p8Canvas
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(gldraw);
    }

    function draw() {
      gltex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, gltex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(gl.getUniformLocation(program, "u_texture0"), 0);
      gldraw();
    }
    window.addEventListener("load", draw, false);
    draw();

    window.d = draw;
  }
}

enforceHTTPS();
checkForUpdates();
var buildNumber = new Date().getTime();
