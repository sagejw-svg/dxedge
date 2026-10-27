var Sh=Object.defineProperty;var wh=(i,t,e)=>t in i?Sh(i,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):i[t]=e;var it=(i,t,e)=>wh(i,typeof t!="symbol"?t+"":t,e);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function e(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=e(s);fetch(s.href,r)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const La="170",bh=0,sl=1,Eh=2,pu=1,Th=2,En=3,_n=0,Be=1,Pe=2,Hn=0,Oi=1,rl=2,ol=3,al=4,Ah=5,ei=100,Rh=101,Ch=102,Ih=103,Ph=104,Lh=200,Dh=201,Uh=202,Nh=203,Uo=204,No=205,Fh=206,Oh=207,Bh=208,kh=209,zh=210,Hh=211,Gh=212,Vh=213,Wh=214,Fo=0,Oo=1,Bo=2,Wi=3,ko=4,zo=5,Ho=6,Go=7,Da=0,$h=1,Xh=2,Gn=0,Yh=1,qh=2,Kh=3,jh=4,Zh=5,Jh=6,Qh=7,mu=300,$i=301,Xi=302,Vo=303,Wo=304,Nr=306,Ye=1e3,ii=1001,$o=1002,Nt=1003,tf=1004,Ds=1005,mn=1006,Vr=1007,si=1008,Rn=1009,gu=1010,_u=1011,bs=1012,Ua=1013,oi=1014,gn=1015,Cs=1016,Na=1017,Fa=1018,Yi=1020,vu=35902,xu=1021,Mu=1022,on=1023,yu=1024,Su=1025,Bi=1026,qi=1027,Oa=1028,Ba=1029,wu=1030,ka=1031,za=1033,gr=33776,_r=33777,vr=33778,xr=33779,Xo=35840,Yo=35841,qo=35842,Ko=35843,jo=36196,Zo=37492,Jo=37496,Qo=37808,ta=37809,ea=37810,na=37811,ia=37812,sa=37813,ra=37814,oa=37815,aa=37816,la=37817,ca=37818,ua=37819,ha=37820,fa=37821,Mr=36492,da=36494,pa=36495,bu=36283,ma=36284,ga=36285,_a=36286,ef=3200,nf=3201,Ha=0,sf=1,zn="",xe="srgb",Ji="srgb-linear",Fr="linear",oe="srgb",hi=7680,ll=519,rf=512,of=513,af=514,Eu=515,lf=516,cf=517,uf=518,hf=519,va=35044,cl="300 es",Tn=2e3,Sr=2001;class Qi{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const s=this._listeners[t];if(s!==void 0){const r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}}const Ce=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Wr=Math.PI/180,xa=180/Math.PI;function Vn(){const i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ce[i&255]+Ce[i>>8&255]+Ce[i>>16&255]+Ce[i>>24&255]+"-"+Ce[t&255]+Ce[t>>8&255]+"-"+Ce[t>>16&15|64]+Ce[t>>24&255]+"-"+Ce[e&63|128]+Ce[e>>8&255]+"-"+Ce[e>>16&255]+Ce[e>>24&255]+Ce[n&255]+Ce[n>>8&255]+Ce[n>>16&255]+Ce[n>>24&255]).toLowerCase()}function Ge(i,t,e){return Math.max(t,Math.min(e,i))}function ff(i,t){return(i%t+t)%t}function $r(i,t,e){return(1-e)*i+e*t}function pn(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function ae(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}class Vt{constructor(t=0,e=0){Vt.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Ge(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*n-o*s+t.x,this.y=r*s+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Gt{constructor(t,e,n,s,r,o,a,c,l){Gt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,c,l)}set(t,e,n,s,r,o,a,c,l){const u=this.elements;return u[0]=t,u[1]=s,u[2]=a,u[3]=e,u[4]=r,u[5]=c,u[6]=n,u[7]=o,u[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[3],c=n[6],l=n[1],u=n[4],f=n[7],d=n[2],m=n[5],p=n[8],_=s[0],g=s[3],h=s[6],S=s[1],b=s[4],x=s[7],P=s[2],T=s[5],C=s[8];return r[0]=o*_+a*S+c*P,r[3]=o*g+a*b+c*T,r[6]=o*h+a*x+c*C,r[1]=l*_+u*S+f*P,r[4]=l*g+u*b+f*T,r[7]=l*h+u*x+f*C,r[2]=d*_+m*S+p*P,r[5]=d*g+m*b+p*T,r[8]=d*h+m*x+p*C,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],c=t[6],l=t[7],u=t[8];return e*o*u-e*a*l-n*r*u+n*a*c+s*r*l-s*o*c}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],c=t[6],l=t[7],u=t[8],f=u*o-a*l,d=a*c-u*r,m=l*r-o*c,p=e*f+n*d+s*m;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/p;return t[0]=f*_,t[1]=(s*l-u*n)*_,t[2]=(a*n-s*o)*_,t[3]=d*_,t[4]=(u*e-s*c)*_,t[5]=(s*r-a*e)*_,t[6]=m*_,t[7]=(n*c-l*e)*_,t[8]=(o*e-n*r)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,o,a){const c=Math.cos(r),l=Math.sin(r);return this.set(n*c,n*l,-n*(c*o+l*a)+o+t,-s*l,s*c,-s*(-l*o+c*a)+a+e,0,0,1),this}scale(t,e){return this.premultiply(Xr.makeScale(t,e)),this}rotate(t){return this.premultiply(Xr.makeRotation(-t)),this}translate(t,e){return this.premultiply(Xr.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Xr=new Gt;function Tu(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function Es(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function df(){const i=Es("canvas");return i.style.display="block",i}const ul={};function ys(i){i in ul||(ul[i]=!0,console.warn(i))}function pf(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}function mf(i){const t=i.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function gf(i){const t=i.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const Qt={enabled:!0,workingColorSpace:Ji,spaces:{},convert:function(i,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===oe&&(i.r=An(i.r),i.g=An(i.g),i.b=An(i.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(i.applyMatrix3(this.spaces[t].toXYZ),i.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===oe&&(i.r=ki(i.r),i.g=ki(i.g),i.b=ki(i.b))),i},fromWorkingColorSpace:function(i,t){return this.convert(i,this.workingColorSpace,t)},toWorkingColorSpace:function(i,t){return this.convert(i,t,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===zn?Fr:this.spaces[i].transfer},getLuminanceCoefficients:function(i,t=this.workingColorSpace){return i.fromArray(this.spaces[t].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,t,e){return i.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function An(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function ki(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}const hl=[.64,.33,.3,.6,.15,.06],fl=[.2126,.7152,.0722],dl=[.3127,.329],pl=new Gt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ml=new Gt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Qt.define({[Ji]:{primaries:hl,whitePoint:dl,transfer:Fr,toXYZ:pl,fromXYZ:ml,luminanceCoefficients:fl,workingColorSpaceConfig:{unpackColorSpace:xe},outputColorSpaceConfig:{drawingBufferColorSpace:xe}},[xe]:{primaries:hl,whitePoint:dl,transfer:oe,toXYZ:pl,fromXYZ:ml,luminanceCoefficients:fl,outputColorSpaceConfig:{drawingBufferColorSpace:xe}}});let fi;class _f{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{fi===void 0&&(fi=Es("canvas")),fi.width=t.width,fi.height=t.height;const n=fi.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=fi}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=Es("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=An(r[o]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(An(e[n]/255)*255):e[n]=An(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let vf=0;class Au{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:vf++}),this.uuid=Vn(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Yr(s[o].image)):r.push(Yr(s[o]))}else r=Yr(s);n.url=r}return e||(t.images[this.uuid]=n),n}}function Yr(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?_f.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let xf=0;class Te extends Qi{constructor(t=Te.DEFAULT_IMAGE,e=Te.DEFAULT_MAPPING,n=ii,s=ii,r=mn,o=si,a=on,c=Rn,l=Te.DEFAULT_ANISOTROPY,u=zn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:xf++}),this.uuid=Vn(),this.name="",this.source=new Au(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=l,this.format=a,this.internalFormat=null,this.type=c,this.offset=new Vt(0,0),this.repeat=new Vt(1,1),this.center=new Vt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Gt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==mu)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Ye:t.x=t.x-Math.floor(t.x);break;case ii:t.x=t.x<0?0:1;break;case $o:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Ye:t.y=t.y-Math.floor(t.y);break;case ii:t.y=t.y<0?0:1;break;case $o:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}Te.DEFAULT_IMAGE=null;Te.DEFAULT_MAPPING=mu;Te.DEFAULT_ANISOTROPY=1;class le{constructor(t=0,e=0,n=0,s=1){le.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*n+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r;const c=t.elements,l=c[0],u=c[4],f=c[8],d=c[1],m=c[5],p=c[9],_=c[2],g=c[6],h=c[10];if(Math.abs(u-d)<.01&&Math.abs(f-_)<.01&&Math.abs(p-g)<.01){if(Math.abs(u+d)<.1&&Math.abs(f+_)<.1&&Math.abs(p+g)<.1&&Math.abs(l+m+h-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const b=(l+1)/2,x=(m+1)/2,P=(h+1)/2,T=(u+d)/4,C=(f+_)/4,R=(p+g)/4;return b>x&&b>P?b<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(b),s=T/n,r=C/n):x>P?x<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(x),n=T/s,r=R/s):P<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(P),n=C/r,s=R/r),this.set(n,s,r,e),this}let S=Math.sqrt((g-p)*(g-p)+(f-_)*(f-_)+(d-u)*(d-u));return Math.abs(S)<.001&&(S=1),this.x=(g-p)/S,this.y=(f-_)/S,this.z=(d-u)/S,this.w=Math.acos((l+m+h-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Mf extends Qi{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new le(0,0,t,e),this.scissorTest=!1,this.viewport=new le(0,0,t,e);const s={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:mn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const r=new Te(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];const o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,s=t.textures.length;n<s;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new Au(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ai extends Mf{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class Ru extends Te{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Nt,this.minFilter=Nt,this.wrapR=ii,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class yf extends Te{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Nt,this.minFilter=Nt,this.wrapR=ii,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class li{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,o,a){let c=n[s+0],l=n[s+1],u=n[s+2],f=n[s+3];const d=r[o+0],m=r[o+1],p=r[o+2],_=r[o+3];if(a===0){t[e+0]=c,t[e+1]=l,t[e+2]=u,t[e+3]=f;return}if(a===1){t[e+0]=d,t[e+1]=m,t[e+2]=p,t[e+3]=_;return}if(f!==_||c!==d||l!==m||u!==p){let g=1-a;const h=c*d+l*m+u*p+f*_,S=h>=0?1:-1,b=1-h*h;if(b>Number.EPSILON){const P=Math.sqrt(b),T=Math.atan2(P,h*S);g=Math.sin(g*T)/P,a=Math.sin(a*T)/P}const x=a*S;if(c=c*g+d*x,l=l*g+m*x,u=u*g+p*x,f=f*g+_*x,g===1-a){const P=1/Math.sqrt(c*c+l*l+u*u+f*f);c*=P,l*=P,u*=P,f*=P}}t[e]=c,t[e+1]=l,t[e+2]=u,t[e+3]=f}static multiplyQuaternionsFlat(t,e,n,s,r,o){const a=n[s],c=n[s+1],l=n[s+2],u=n[s+3],f=r[o],d=r[o+1],m=r[o+2],p=r[o+3];return t[e]=a*p+u*f+c*m-l*d,t[e+1]=c*p+u*d+l*f-a*m,t[e+2]=l*p+u*m+a*d-c*f,t[e+3]=u*p-a*f-c*d-l*m,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,c=Math.sin,l=a(n/2),u=a(s/2),f=a(r/2),d=c(n/2),m=c(s/2),p=c(r/2);switch(o){case"XYZ":this._x=d*u*f+l*m*p,this._y=l*m*f-d*u*p,this._z=l*u*p+d*m*f,this._w=l*u*f-d*m*p;break;case"YXZ":this._x=d*u*f+l*m*p,this._y=l*m*f-d*u*p,this._z=l*u*p-d*m*f,this._w=l*u*f+d*m*p;break;case"ZXY":this._x=d*u*f-l*m*p,this._y=l*m*f+d*u*p,this._z=l*u*p+d*m*f,this._w=l*u*f-d*m*p;break;case"ZYX":this._x=d*u*f-l*m*p,this._y=l*m*f+d*u*p,this._z=l*u*p-d*m*f,this._w=l*u*f+d*m*p;break;case"YZX":this._x=d*u*f+l*m*p,this._y=l*m*f+d*u*p,this._z=l*u*p-d*m*f,this._w=l*u*f-d*m*p;break;case"XZY":this._x=d*u*f-l*m*p,this._y=l*m*f-d*u*p,this._z=l*u*p+d*m*f,this._w=l*u*f+d*m*p;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],s=e[4],r=e[8],o=e[1],a=e[5],c=e[9],l=e[2],u=e[6],f=e[10],d=n+a+f;if(d>0){const m=.5/Math.sqrt(d+1);this._w=.25/m,this._x=(u-c)*m,this._y=(r-l)*m,this._z=(o-s)*m}else if(n>a&&n>f){const m=2*Math.sqrt(1+n-a-f);this._w=(u-c)/m,this._x=.25*m,this._y=(s+o)/m,this._z=(r+l)/m}else if(a>f){const m=2*Math.sqrt(1+a-n-f);this._w=(r-l)/m,this._x=(s+o)/m,this._y=.25*m,this._z=(c+u)/m}else{const m=2*Math.sqrt(1+f-n-a);this._w=(o-s)/m,this._x=(r+l)/m,this._y=(c+u)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Ge(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,s=t._y,r=t._z,o=t._w,a=e._x,c=e._y,l=e._z,u=e._w;return this._x=n*u+o*a+s*l-r*c,this._y=s*u+o*c+r*a-n*l,this._z=r*u+o*l+n*c-s*a,this._w=o*u-n*a-s*c-r*l,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,s=this._y,r=this._z,o=this._w;let a=o*t._w+n*t._x+s*t._y+r*t._z;if(a<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,a=-a):this.copy(t),a>=1)return this._w=o,this._x=n,this._y=s,this._z=r,this;const c=1-a*a;if(c<=Number.EPSILON){const m=1-e;return this._w=m*o+e*this._w,this._x=m*n+e*this._x,this._y=m*s+e*this._y,this._z=m*r+e*this._z,this.normalize(),this}const l=Math.sqrt(c),u=Math.atan2(l,a),f=Math.sin((1-e)*u)/l,d=Math.sin(e*u)/l;return this._w=o*f+this._w*d,this._x=n*f+this._x*d,this._y=s*f+this._y*d,this._z=r*f+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class k{constructor(t=0,e=0,n=0){k.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(gl.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(gl.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(t){const e=this.x,n=this.y,s=this.z,r=t.x,o=t.y,a=t.z,c=t.w,l=2*(o*s-a*n),u=2*(a*e-r*s),f=2*(r*n-o*e);return this.x=e+c*l+o*f-a*u,this.y=n+c*u+a*l-r*f,this.z=s+c*f+r*u-o*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,s=t.y,r=t.z,o=e.x,a=e.y,c=e.z;return this.x=s*c-r*a,this.y=r*o-n*c,this.z=n*a-s*o,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return qr.copy(this).projectOnVector(t),this.sub(qr)}reflect(t){return this.sub(qr.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Ge(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const qr=new k,gl=new li;class ci{constructor(t=new k(1/0,1/0,1/0),e=new k(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(nn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(nn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=nn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,nn):nn.fromBufferAttribute(r,o),nn.applyMatrix4(t.matrixWorld),this.expandByPoint(nn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Us.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Us.copy(n.boundingBox)),Us.applyMatrix4(t.matrixWorld),this.union(Us)}const s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,nn),nn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(as),Ns.subVectors(this.max,as),di.subVectors(t.a,as),pi.subVectors(t.b,as),mi.subVectors(t.c,as),Un.subVectors(pi,di),Nn.subVectors(mi,pi),Yn.subVectors(di,mi);let e=[0,-Un.z,Un.y,0,-Nn.z,Nn.y,0,-Yn.z,Yn.y,Un.z,0,-Un.x,Nn.z,0,-Nn.x,Yn.z,0,-Yn.x,-Un.y,Un.x,0,-Nn.y,Nn.x,0,-Yn.y,Yn.x,0];return!Kr(e,di,pi,mi,Ns)||(e=[1,0,0,0,1,0,0,0,1],!Kr(e,di,pi,mi,Ns))?!1:(Fs.crossVectors(Un,Nn),e=[Fs.x,Fs.y,Fs.z],Kr(e,di,pi,mi,Ns))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,nn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(nn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Mn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Mn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Mn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Mn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Mn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Mn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Mn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Mn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Mn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const Mn=[new k,new k,new k,new k,new k,new k,new k,new k],nn=new k,Us=new ci,di=new k,pi=new k,mi=new k,Un=new k,Nn=new k,Yn=new k,as=new k,Ns=new k,Fs=new k,qn=new k;function Kr(i,t,e,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){qn.fromArray(i,r);const a=s.x*Math.abs(qn.x)+s.y*Math.abs(qn.y)+s.z*Math.abs(qn.z),c=t.dot(qn),l=e.dot(qn),u=n.dot(qn);if(Math.max(-Math.max(c,l,u),Math.min(c,l,u))>a)return!1}return!0}const Sf=new ci,ls=new k,jr=new k;class ts{constructor(t=new k,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Sf.setFromPoints(t).getCenter(n);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;ls.subVectors(t,this.center);const e=ls.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(ls,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(jr.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(ls.copy(t.center).add(jr)),this.expandByPoint(ls.copy(t.center).sub(jr))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const yn=new k,Zr=new k,Os=new k,Fn=new k,Jr=new k,Bs=new k,Qr=new k;class Cu{constructor(t=new k,e=new k(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,yn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=yn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(yn.copy(this.origin).addScaledVector(this.direction,e),yn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){Zr.copy(t).add(e).multiplyScalar(.5),Os.copy(e).sub(t).normalize(),Fn.copy(this.origin).sub(Zr);const r=t.distanceTo(e)*.5,o=-this.direction.dot(Os),a=Fn.dot(this.direction),c=-Fn.dot(Os),l=Fn.lengthSq(),u=Math.abs(1-o*o);let f,d,m,p;if(u>0)if(f=o*c-a,d=o*a-c,p=r*u,f>=0)if(d>=-p)if(d<=p){const _=1/u;f*=_,d*=_,m=f*(f+o*d+2*a)+d*(o*f+d+2*c)+l}else d=r,f=Math.max(0,-(o*d+a)),m=-f*f+d*(d+2*c)+l;else d=-r,f=Math.max(0,-(o*d+a)),m=-f*f+d*(d+2*c)+l;else d<=-p?(f=Math.max(0,-(-o*r+a)),d=f>0?-r:Math.min(Math.max(-r,-c),r),m=-f*f+d*(d+2*c)+l):d<=p?(f=0,d=Math.min(Math.max(-r,-c),r),m=d*(d+2*c)+l):(f=Math.max(0,-(o*r+a)),d=f>0?r:Math.min(Math.max(-r,-c),r),m=-f*f+d*(d+2*c)+l);else d=o>0?-r:r,f=Math.max(0,-(o*d+a)),m=-f*f+d*(d+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(Zr).addScaledVector(Os,d),m}intersectSphere(t,e){yn.subVectors(t.center,this.origin);const n=yn.dot(this.direction),s=yn.dot(yn)-n*n,r=t.radius*t.radius;if(s>r)return null;const o=Math.sqrt(r-s),a=n-o,c=n+o;return c<0?null:a<0?this.at(c,e):this.at(a,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,o,a,c;const l=1/this.direction.x,u=1/this.direction.y,f=1/this.direction.z,d=this.origin;return l>=0?(n=(t.min.x-d.x)*l,s=(t.max.x-d.x)*l):(n=(t.max.x-d.x)*l,s=(t.min.x-d.x)*l),u>=0?(r=(t.min.y-d.y)*u,o=(t.max.y-d.y)*u):(r=(t.max.y-d.y)*u,o=(t.min.y-d.y)*u),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),f>=0?(a=(t.min.z-d.z)*f,c=(t.max.z-d.z)*f):(a=(t.max.z-d.z)*f,c=(t.min.z-d.z)*f),n>c||a>s)||((a>n||n!==n)&&(n=a),(c<s||s!==s)&&(s=c),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,yn)!==null}intersectTriangle(t,e,n,s,r){Jr.subVectors(e,t),Bs.subVectors(n,t),Qr.crossVectors(Jr,Bs);let o=this.direction.dot(Qr),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Fn.subVectors(this.origin,t);const c=a*this.direction.dot(Bs.crossVectors(Fn,Bs));if(c<0)return null;const l=a*this.direction.dot(Jr.cross(Fn));if(l<0||c+l>o)return null;const u=-a*Fn.dot(Qr);return u<0?null:this.at(u/o,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class re{constructor(t,e,n,s,r,o,a,c,l,u,f,d,m,p,_,g){re.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,c,l,u,f,d,m,p,_,g)}set(t,e,n,s,r,o,a,c,l,u,f,d,m,p,_,g){const h=this.elements;return h[0]=t,h[4]=e,h[8]=n,h[12]=s,h[1]=r,h[5]=o,h[9]=a,h[13]=c,h[2]=l,h[6]=u,h[10]=f,h[14]=d,h[3]=m,h[7]=p,h[11]=_,h[15]=g,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new re().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,s=1/gi.setFromMatrixColumn(t,0).length(),r=1/gi.setFromMatrixColumn(t,1).length(),o=1/gi.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,s=t.y,r=t.z,o=Math.cos(n),a=Math.sin(n),c=Math.cos(s),l=Math.sin(s),u=Math.cos(r),f=Math.sin(r);if(t.order==="XYZ"){const d=o*u,m=o*f,p=a*u,_=a*f;e[0]=c*u,e[4]=-c*f,e[8]=l,e[1]=m+p*l,e[5]=d-_*l,e[9]=-a*c,e[2]=_-d*l,e[6]=p+m*l,e[10]=o*c}else if(t.order==="YXZ"){const d=c*u,m=c*f,p=l*u,_=l*f;e[0]=d+_*a,e[4]=p*a-m,e[8]=o*l,e[1]=o*f,e[5]=o*u,e[9]=-a,e[2]=m*a-p,e[6]=_+d*a,e[10]=o*c}else if(t.order==="ZXY"){const d=c*u,m=c*f,p=l*u,_=l*f;e[0]=d-_*a,e[4]=-o*f,e[8]=p+m*a,e[1]=m+p*a,e[5]=o*u,e[9]=_-d*a,e[2]=-o*l,e[6]=a,e[10]=o*c}else if(t.order==="ZYX"){const d=o*u,m=o*f,p=a*u,_=a*f;e[0]=c*u,e[4]=p*l-m,e[8]=d*l+_,e[1]=c*f,e[5]=_*l+d,e[9]=m*l-p,e[2]=-l,e[6]=a*c,e[10]=o*c}else if(t.order==="YZX"){const d=o*c,m=o*l,p=a*c,_=a*l;e[0]=c*u,e[4]=_-d*f,e[8]=p*f+m,e[1]=f,e[5]=o*u,e[9]=-a*u,e[2]=-l*u,e[6]=m*f+p,e[10]=d-_*f}else if(t.order==="XZY"){const d=o*c,m=o*l,p=a*c,_=a*l;e[0]=c*u,e[4]=-f,e[8]=l*u,e[1]=d*f+_,e[5]=o*u,e[9]=m*f-p,e[2]=p*f-m,e[6]=a*u,e[10]=_*f+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(wf,t,bf)}lookAt(t,e,n){const s=this.elements;return $e.subVectors(t,e),$e.lengthSq()===0&&($e.z=1),$e.normalize(),On.crossVectors(n,$e),On.lengthSq()===0&&(Math.abs(n.z)===1?$e.x+=1e-4:$e.z+=1e-4,$e.normalize(),On.crossVectors(n,$e)),On.normalize(),ks.crossVectors($e,On),s[0]=On.x,s[4]=ks.x,s[8]=$e.x,s[1]=On.y,s[5]=ks.y,s[9]=$e.y,s[2]=On.z,s[6]=ks.z,s[10]=$e.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[4],c=n[8],l=n[12],u=n[1],f=n[5],d=n[9],m=n[13],p=n[2],_=n[6],g=n[10],h=n[14],S=n[3],b=n[7],x=n[11],P=n[15],T=s[0],C=s[4],R=s[8],y=s[12],v=s[1],A=s[5],H=s[9],L=s[13],z=s[2],$=s[6],W=s[10],Z=s[14],N=s[3],at=s[7],mt=s[11],lt=s[15];return r[0]=o*T+a*v+c*z+l*N,r[4]=o*C+a*A+c*$+l*at,r[8]=o*R+a*H+c*W+l*mt,r[12]=o*y+a*L+c*Z+l*lt,r[1]=u*T+f*v+d*z+m*N,r[5]=u*C+f*A+d*$+m*at,r[9]=u*R+f*H+d*W+m*mt,r[13]=u*y+f*L+d*Z+m*lt,r[2]=p*T+_*v+g*z+h*N,r[6]=p*C+_*A+g*$+h*at,r[10]=p*R+_*H+g*W+h*mt,r[14]=p*y+_*L+g*Z+h*lt,r[3]=S*T+b*v+x*z+P*N,r[7]=S*C+b*A+x*$+P*at,r[11]=S*R+b*H+x*W+P*mt,r[15]=S*y+b*L+x*Z+P*lt,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],o=t[1],a=t[5],c=t[9],l=t[13],u=t[2],f=t[6],d=t[10],m=t[14],p=t[3],_=t[7],g=t[11],h=t[15];return p*(+r*c*f-s*l*f-r*a*d+n*l*d+s*a*m-n*c*m)+_*(+e*c*m-e*l*d+r*o*d-s*o*m+s*l*u-r*c*u)+g*(+e*l*f-e*a*m-r*o*f+n*o*m+r*a*u-n*l*u)+h*(-s*a*u-e*c*f+e*a*d+s*o*f-n*o*d+n*c*u)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],c=t[6],l=t[7],u=t[8],f=t[9],d=t[10],m=t[11],p=t[12],_=t[13],g=t[14],h=t[15],S=f*g*l-_*d*l+_*c*m-a*g*m-f*c*h+a*d*h,b=p*d*l-u*g*l-p*c*m+o*g*m+u*c*h-o*d*h,x=u*_*l-p*f*l+p*a*m-o*_*m-u*a*h+o*f*h,P=p*f*c-u*_*c-p*a*d+o*_*d+u*a*g-o*f*g,T=e*S+n*b+s*x+r*P;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const C=1/T;return t[0]=S*C,t[1]=(_*d*r-f*g*r-_*s*m+n*g*m+f*s*h-n*d*h)*C,t[2]=(a*g*r-_*c*r+_*s*l-n*g*l-a*s*h+n*c*h)*C,t[3]=(f*c*r-a*d*r-f*s*l+n*d*l+a*s*m-n*c*m)*C,t[4]=b*C,t[5]=(u*g*r-p*d*r+p*s*m-e*g*m-u*s*h+e*d*h)*C,t[6]=(p*c*r-o*g*r-p*s*l+e*g*l+o*s*h-e*c*h)*C,t[7]=(o*d*r-u*c*r+u*s*l-e*d*l-o*s*m+e*c*m)*C,t[8]=x*C,t[9]=(p*f*r-u*_*r-p*n*m+e*_*m+u*n*h-e*f*h)*C,t[10]=(o*_*r-p*a*r+p*n*l-e*_*l-o*n*h+e*a*h)*C,t[11]=(u*a*r-o*f*r-u*n*l+e*f*l+o*n*m-e*a*m)*C,t[12]=P*C,t[13]=(u*_*s-p*f*s+p*n*d-e*_*d-u*n*g+e*f*g)*C,t[14]=(p*a*s-o*_*s-p*n*c+e*_*c+o*n*g-e*a*g)*C,t[15]=(o*f*s-u*a*s+u*n*c-e*f*c-o*n*d+e*a*d)*C,this}scale(t){const e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),s=Math.sin(e),r=1-n,o=t.x,a=t.y,c=t.z,l=r*o,u=r*a;return this.set(l*o+n,l*a-s*c,l*c+s*a,0,l*a+s*c,u*a+n,u*c-s*o,0,l*c-s*a,u*c+s*o,r*c*c+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,o){return this.set(1,n,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){const s=this.elements,r=e._x,o=e._y,a=e._z,c=e._w,l=r+r,u=o+o,f=a+a,d=r*l,m=r*u,p=r*f,_=o*u,g=o*f,h=a*f,S=c*l,b=c*u,x=c*f,P=n.x,T=n.y,C=n.z;return s[0]=(1-(_+h))*P,s[1]=(m+x)*P,s[2]=(p-b)*P,s[3]=0,s[4]=(m-x)*T,s[5]=(1-(d+h))*T,s[6]=(g+S)*T,s[7]=0,s[8]=(p+b)*C,s[9]=(g-S)*C,s[10]=(1-(d+_))*C,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){const s=this.elements;let r=gi.set(s[0],s[1],s[2]).length();const o=gi.set(s[4],s[5],s[6]).length(),a=gi.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],sn.copy(this);const l=1/r,u=1/o,f=1/a;return sn.elements[0]*=l,sn.elements[1]*=l,sn.elements[2]*=l,sn.elements[4]*=u,sn.elements[5]*=u,sn.elements[6]*=u,sn.elements[8]*=f,sn.elements[9]*=f,sn.elements[10]*=f,e.setFromRotationMatrix(sn),n.x=r,n.y=o,n.z=a,this}makePerspective(t,e,n,s,r,o,a=Tn){const c=this.elements,l=2*r/(e-t),u=2*r/(n-s),f=(e+t)/(e-t),d=(n+s)/(n-s);let m,p;if(a===Tn)m=-(o+r)/(o-r),p=-2*o*r/(o-r);else if(a===Sr)m=-o/(o-r),p=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=l,c[4]=0,c[8]=f,c[12]=0,c[1]=0,c[5]=u,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=m,c[14]=p,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,o,a=Tn){const c=this.elements,l=1/(e-t),u=1/(n-s),f=1/(o-r),d=(e+t)*l,m=(n+s)*u;let p,_;if(a===Tn)p=(o+r)*f,_=-2*f;else if(a===Sr)p=r*f,_=-1*f;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=2*l,c[4]=0,c[8]=0,c[12]=-d,c[1]=0,c[5]=2*u,c[9]=0,c[13]=-m,c[2]=0,c[6]=0,c[10]=_,c[14]=-p,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const gi=new k,sn=new re,wf=new k(0,0,0),bf=new k(1,1,1),On=new k,ks=new k,$e=new k,_l=new re,vl=new li;class an{constructor(t=0,e=0,n=0,s=an.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const s=t.elements,r=s[0],o=s[4],a=s[8],c=s[1],l=s[5],u=s[9],f=s[2],d=s[6],m=s[10];switch(e){case"XYZ":this._y=Math.asin(Ge(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,m),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,l),this._z=0);break;case"YXZ":this._x=Math.asin(-Ge(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,m),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(Ge(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-f,m),this._z=Math.atan2(-o,l)):(this._y=0,this._z=Math.atan2(c,r));break;case"ZYX":this._y=Math.asin(-Ge(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(d,m),this._z=Math.atan2(c,r)):(this._x=0,this._z=Math.atan2(-o,l));break;case"YZX":this._z=Math.asin(Ge(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-u,l),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,m));break;case"XZY":this._z=Math.asin(-Ge(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,l),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-u,m),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return _l.makeRotationFromQuaternion(t),this.setFromRotationMatrix(_l,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return vl.setFromEuler(this),this.setFromQuaternion(vl,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}an.DEFAULT_ORDER="XYZ";class Iu{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Ef=0;const xl=new k,_i=new li,Sn=new re,zs=new k,cs=new k,Tf=new k,Af=new li,Ml=new k(1,0,0),yl=new k(0,1,0),Sl=new k(0,0,1),wl={type:"added"},Rf={type:"removed"},vi={type:"childadded",child:null},to={type:"childremoved",child:null};class Ae extends Qi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ef++}),this.uuid=Vn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Ae.DEFAULT_UP.clone();const t=new k,e=new an,n=new li,s=new k(1,1,1);function r(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new re},normalMatrix:{value:new Gt}}),this.matrix=new re,this.matrixWorld=new re,this.matrixAutoUpdate=Ae.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Ae.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Iu,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return _i.setFromAxisAngle(t,e),this.quaternion.multiply(_i),this}rotateOnWorldAxis(t,e){return _i.setFromAxisAngle(t,e),this.quaternion.premultiply(_i),this}rotateX(t){return this.rotateOnAxis(Ml,t)}rotateY(t){return this.rotateOnAxis(yl,t)}rotateZ(t){return this.rotateOnAxis(Sl,t)}translateOnAxis(t,e){return xl.copy(t).applyQuaternion(this.quaternion),this.position.add(xl.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Ml,t)}translateY(t){return this.translateOnAxis(yl,t)}translateZ(t){return this.translateOnAxis(Sl,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Sn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?zs.copy(t):zs.set(t,e,n);const s=this.parent;this.updateWorldMatrix(!0,!1),cs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Sn.lookAt(cs,zs,this.up):Sn.lookAt(zs,cs,this.up),this.quaternion.setFromRotationMatrix(Sn),s&&(Sn.extractRotation(s.matrixWorld),_i.setFromRotationMatrix(Sn),this.quaternion.premultiply(_i.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(wl),vi.child=t,this.dispatchEvent(vi),vi.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Rf),to.child=t,this.dispatchEvent(to),to.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Sn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Sn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Sn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(wl),vi.child=t,this.dispatchEvent(vi),vi.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){const o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(cs,t,Tf),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(cs,Af,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(t)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const c=a.shapes;if(Array.isArray(c))for(let l=0,u=c.length;l<u;l++){const f=c[l];r(t.shapes,f)}else r(t.shapes,c)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let c=0,l=this.material.length;c<l;c++)a.push(r(t.materials,this.material[c]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){const c=this.animations[a];s.animations.push(r(t.animations,c))}}if(e){const a=o(t.geometries),c=o(t.materials),l=o(t.textures),u=o(t.images),f=o(t.shapes),d=o(t.skeletons),m=o(t.animations),p=o(t.nodes);a.length>0&&(n.geometries=a),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),u.length>0&&(n.images=u),f.length>0&&(n.shapes=f),d.length>0&&(n.skeletons=d),m.length>0&&(n.animations=m),p.length>0&&(n.nodes=p)}return n.object=s,n;function o(a){const c=[];for(const l in a){const u=a[l];delete u.metadata,c.push(u)}return c}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const s=t.children[n];this.add(s.clone())}return this}}Ae.DEFAULT_UP=new k(0,1,0);Ae.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ae.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const rn=new k,wn=new k,eo=new k,bn=new k,xi=new k,Mi=new k,bl=new k,no=new k,io=new k,so=new k,ro=new le,oo=new le,ao=new le;class Je{constructor(t=new k,e=new k,n=new k){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),rn.subVectors(t,e),s.cross(rn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){rn.subVectors(s,e),wn.subVectors(n,e),eo.subVectors(t,e);const o=rn.dot(rn),a=rn.dot(wn),c=rn.dot(eo),l=wn.dot(wn),u=wn.dot(eo),f=o*l-a*a;if(f===0)return r.set(0,0,0),null;const d=1/f,m=(l*c-a*u)*d,p=(o*u-a*c)*d;return r.set(1-m-p,p,m)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,bn)===null?!1:bn.x>=0&&bn.y>=0&&bn.x+bn.y<=1}static getInterpolation(t,e,n,s,r,o,a,c){return this.getBarycoord(t,e,n,s,bn)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(r,bn.x),c.addScaledVector(o,bn.y),c.addScaledVector(a,bn.z),c)}static getInterpolatedAttribute(t,e,n,s,r,o){return ro.setScalar(0),oo.setScalar(0),ao.setScalar(0),ro.fromBufferAttribute(t,e),oo.fromBufferAttribute(t,n),ao.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(ro,r.x),o.addScaledVector(oo,r.y),o.addScaledVector(ao,r.z),o}static isFrontFacing(t,e,n,s){return rn.subVectors(n,e),wn.subVectors(t,e),rn.cross(wn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return rn.subVectors(this.c,this.b),wn.subVectors(this.a,this.b),rn.cross(wn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Je.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Je.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return Je.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return Je.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Je.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,s=this.b,r=this.c;let o,a;xi.subVectors(s,n),Mi.subVectors(r,n),no.subVectors(t,n);const c=xi.dot(no),l=Mi.dot(no);if(c<=0&&l<=0)return e.copy(n);io.subVectors(t,s);const u=xi.dot(io),f=Mi.dot(io);if(u>=0&&f<=u)return e.copy(s);const d=c*f-u*l;if(d<=0&&c>=0&&u<=0)return o=c/(c-u),e.copy(n).addScaledVector(xi,o);so.subVectors(t,r);const m=xi.dot(so),p=Mi.dot(so);if(p>=0&&m<=p)return e.copy(r);const _=m*l-c*p;if(_<=0&&l>=0&&p<=0)return a=l/(l-p),e.copy(n).addScaledVector(Mi,a);const g=u*p-m*f;if(g<=0&&f-u>=0&&m-p>=0)return bl.subVectors(r,s),a=(f-u)/(f-u+(m-p)),e.copy(s).addScaledVector(bl,a);const h=1/(g+_+d);return o=_*h,a=d*h,e.copy(n).addScaledVector(xi,o).addScaledVector(Mi,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const Pu={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Bn={h:0,s:0,l:0},Hs={h:0,s:0,l:0};function lo(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}class kt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=xe){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Qt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,s=Qt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Qt.toWorkingColorSpace(this,s),this}setHSL(t,e,n,s=Qt.workingColorSpace){if(t=ff(t,1),e=Ge(e,0,1),n=Ge(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,o=2*n-r;this.r=lo(o,r,t+1/3),this.g=lo(o,r,t),this.b=lo(o,r,t-1/3)}return Qt.toWorkingColorSpace(this,s),this}setStyle(t,e=xe){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=xe){const n=Pu[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=An(t.r),this.g=An(t.g),this.b=An(t.b),this}copyLinearToSRGB(t){return this.r=ki(t.r),this.g=ki(t.g),this.b=ki(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=xe){return Qt.fromWorkingColorSpace(Ie.copy(this),t),Math.round(Ge(Ie.r*255,0,255))*65536+Math.round(Ge(Ie.g*255,0,255))*256+Math.round(Ge(Ie.b*255,0,255))}getHexString(t=xe){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Qt.workingColorSpace){Qt.fromWorkingColorSpace(Ie.copy(this),e);const n=Ie.r,s=Ie.g,r=Ie.b,o=Math.max(n,s,r),a=Math.min(n,s,r);let c,l;const u=(a+o)/2;if(a===o)c=0,l=0;else{const f=o-a;switch(l=u<=.5?f/(o+a):f/(2-o-a),o){case n:c=(s-r)/f+(s<r?6:0);break;case s:c=(r-n)/f+2;break;case r:c=(n-s)/f+4;break}c/=6}return t.h=c,t.s=l,t.l=u,t}getRGB(t,e=Qt.workingColorSpace){return Qt.fromWorkingColorSpace(Ie.copy(this),e),t.r=Ie.r,t.g=Ie.g,t.b=Ie.b,t}getStyle(t=xe){Qt.fromWorkingColorSpace(Ie.copy(this),t);const e=Ie.r,n=Ie.g,s=Ie.b;return t!==xe?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Bn),this.setHSL(Bn.h+t,Bn.s+e,Bn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Bn),t.getHSL(Hs);const n=$r(Bn.h,Hs.h,e),s=$r(Bn.s,Hs.s,e),r=$r(Bn.l,Hs.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ie=new kt;kt.NAMES=Pu;let Cf=0;class $n extends Qi{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Cf++}),this.uuid=Vn(),this.name="",this.blending=Oi,this.side=_n,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Uo,this.blendDst=No,this.blendEquation=ei,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new kt(0,0,0),this.blendAlpha=0,this.depthFunc=Wi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ll,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=hi,this.stencilZFail=hi,this.stencilZPass=hi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const s=this[e];if(s===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Oi&&(n.blending=this.blending),this.side!==_n&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Uo&&(n.blendSrc=this.blendSrc),this.blendDst!==No&&(n.blendDst=this.blendDst),this.blendEquation!==ei&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Wi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==ll&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==hi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==hi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==hi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const o=[];for(const a in r){const c=r[a];delete c.metadata,o.push(c)}return o}if(e){const r=s(t.textures),o=s(t.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class es extends $n{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new kt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new an,this.combine=Da,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const Me=new k,Gs=new Vt;class Le{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=va,this.updateRanges=[],this.gpuType=gn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Gs.fromBufferAttribute(this,e),Gs.applyMatrix3(t),this.setXY(e,Gs.x,Gs.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.applyMatrix3(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.applyMatrix4(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.applyNormalMatrix(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Me.fromBufferAttribute(this,e),Me.transformDirection(t),this.setXYZ(e,Me.x,Me.y,Me.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=pn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=ae(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=pn(e,this.array)),e}setX(t,e){return this.normalized&&(e=ae(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=pn(e,this.array)),e}setY(t,e){return this.normalized&&(e=ae(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=pn(e,this.array)),e}setZ(t,e){return this.normalized&&(e=ae(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=pn(e,this.array)),e}setW(t,e){return this.normalized&&(e=ae(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=ae(e,this.array),n=ae(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=ae(e,this.array),n=ae(n,this.array),s=ae(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=ae(e,this.array),n=ae(n,this.array),s=ae(s,this.array),r=ae(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==va&&(t.usage=this.usage),t}}class Lu extends Le{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class Du extends Le{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class me extends Le{constructor(t,e,n){super(new Float32Array(t),e,n)}}let If=0;const Ke=new re,co=new Ae,yi=new k,Xe=new ci,us=new ci,Ee=new k;class De extends Qi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:If++}),this.uuid=Vn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Tu(t)?Du:Lu)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Gt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Ke.makeRotationFromQuaternion(t),this.applyMatrix4(Ke),this}rotateX(t){return Ke.makeRotationX(t),this.applyMatrix4(Ke),this}rotateY(t){return Ke.makeRotationY(t),this.applyMatrix4(Ke),this}rotateZ(t){return Ke.makeRotationZ(t),this.applyMatrix4(Ke),this}translate(t,e,n){return Ke.makeTranslation(t,e,n),this.applyMatrix4(Ke),this}scale(t,e,n){return Ke.makeScale(t,e,n),this.applyMatrix4(Ke),this}lookAt(t){return co.lookAt(t),co.updateMatrix(),this.applyMatrix4(co.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(yi).negate(),this.translate(yi.x,yi.y,yi.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let s=0,r=t.length;s<r;s++){const o=t[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new me(n,3))}else{for(let n=0,s=e.count;n<s;n++){const r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ci);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new k(-1/0,-1/0,-1/0),new k(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){const r=e[n];Xe.setFromBufferAttribute(r),this.morphTargetsRelative?(Ee.addVectors(this.boundingBox.min,Xe.min),this.boundingBox.expandByPoint(Ee),Ee.addVectors(this.boundingBox.max,Xe.max),this.boundingBox.expandByPoint(Ee)):(this.boundingBox.expandByPoint(Xe.min),this.boundingBox.expandByPoint(Xe.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ts);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new k,1/0);return}if(t){const n=this.boundingSphere.center;if(Xe.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){const a=e[r];us.setFromBufferAttribute(a),this.morphTargetsRelative?(Ee.addVectors(Xe.min,us.min),Xe.expandByPoint(Ee),Ee.addVectors(Xe.max,us.max),Xe.expandByPoint(Ee)):(Xe.expandByPoint(us.min),Xe.expandByPoint(us.max))}Xe.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)Ee.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Ee));if(e)for(let r=0,o=e.length;r<o;r++){const a=e[r],c=this.morphTargetsRelative;for(let l=0,u=a.count;l<u;l++)Ee.fromBufferAttribute(a,l),c&&(yi.fromBufferAttribute(t,l),Ee.add(yi)),s=Math.max(s,n.distanceToSquared(Ee))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,s=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Le(new Float32Array(4*n.count),4));const o=this.getAttribute("tangent"),a=[],c=[];for(let R=0;R<n.count;R++)a[R]=new k,c[R]=new k;const l=new k,u=new k,f=new k,d=new Vt,m=new Vt,p=new Vt,_=new k,g=new k;function h(R,y,v){l.fromBufferAttribute(n,R),u.fromBufferAttribute(n,y),f.fromBufferAttribute(n,v),d.fromBufferAttribute(r,R),m.fromBufferAttribute(r,y),p.fromBufferAttribute(r,v),u.sub(l),f.sub(l),m.sub(d),p.sub(d);const A=1/(m.x*p.y-p.x*m.y);isFinite(A)&&(_.copy(u).multiplyScalar(p.y).addScaledVector(f,-m.y).multiplyScalar(A),g.copy(f).multiplyScalar(m.x).addScaledVector(u,-p.x).multiplyScalar(A),a[R].add(_),a[y].add(_),a[v].add(_),c[R].add(g),c[y].add(g),c[v].add(g))}let S=this.groups;S.length===0&&(S=[{start:0,count:t.count}]);for(let R=0,y=S.length;R<y;++R){const v=S[R],A=v.start,H=v.count;for(let L=A,z=A+H;L<z;L+=3)h(t.getX(L+0),t.getX(L+1),t.getX(L+2))}const b=new k,x=new k,P=new k,T=new k;function C(R){P.fromBufferAttribute(s,R),T.copy(P);const y=a[R];b.copy(y),b.sub(P.multiplyScalar(P.dot(y))).normalize(),x.crossVectors(T,y);const A=x.dot(c[R])<0?-1:1;o.setXYZW(R,b.x,b.y,b.z,A)}for(let R=0,y=S.length;R<y;++R){const v=S[R],A=v.start,H=v.count;for(let L=A,z=A+H;L<z;L+=3)C(t.getX(L+0)),C(t.getX(L+1)),C(t.getX(L+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Le(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,m=n.count;d<m;d++)n.setXYZ(d,0,0,0);const s=new k,r=new k,o=new k,a=new k,c=new k,l=new k,u=new k,f=new k;if(t)for(let d=0,m=t.count;d<m;d+=3){const p=t.getX(d+0),_=t.getX(d+1),g=t.getX(d+2);s.fromBufferAttribute(e,p),r.fromBufferAttribute(e,_),o.fromBufferAttribute(e,g),u.subVectors(o,r),f.subVectors(s,r),u.cross(f),a.fromBufferAttribute(n,p),c.fromBufferAttribute(n,_),l.fromBufferAttribute(n,g),a.add(u),c.add(u),l.add(u),n.setXYZ(p,a.x,a.y,a.z),n.setXYZ(_,c.x,c.y,c.z),n.setXYZ(g,l.x,l.y,l.z)}else for(let d=0,m=e.count;d<m;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),o.fromBufferAttribute(e,d+2),u.subVectors(o,r),f.subVectors(s,r),u.cross(f),n.setXYZ(d+0,u.x,u.y,u.z),n.setXYZ(d+1,u.x,u.y,u.z),n.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Ee.fromBufferAttribute(t,e),Ee.normalize(),t.setXYZ(e,Ee.x,Ee.y,Ee.z)}toNonIndexed(){function t(a,c){const l=a.array,u=a.itemSize,f=a.normalized,d=new l.constructor(c.length*u);let m=0,p=0;for(let _=0,g=c.length;_<g;_++){a.isInterleavedBufferAttribute?m=c[_]*a.data.stride+a.offset:m=c[_]*u;for(let h=0;h<u;h++)d[p++]=l[m++]}return new Le(d,u,f)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new De,n=this.index.array,s=this.attributes;for(const a in s){const c=s[a],l=t(c,n);e.setAttribute(a,l)}const r=this.morphAttributes;for(const a in r){const c=[],l=r[a];for(let u=0,f=l.length;u<f;u++){const d=l[u],m=t(d,n);c.push(m)}e.morphAttributes[a]=c}e.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,c=o.length;a<c;a++){const l=o[a];e.addGroup(l.start,l.count,l.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const c=this.parameters;for(const l in c)c[l]!==void 0&&(t[l]=c[l]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const c in n){const l=n[c];t.data.attributes[c]=l.toJSON(t.data)}const s={};let r=!1;for(const c in this.morphAttributes){const l=this.morphAttributes[c],u=[];for(let f=0,d=l.length;f<d;f++){const m=l[f];u.push(m.toJSON(t.data))}u.length>0&&(s[c]=u,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(t.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const s=t.attributes;for(const l in s){const u=s[l];this.setAttribute(l,u.clone(e))}const r=t.morphAttributes;for(const l in r){const u=[],f=r[l];for(let d=0,m=f.length;d<m;d++)u.push(f[d].clone(e));this.morphAttributes[l]=u}this.morphTargetsRelative=t.morphTargetsRelative;const o=t.groups;for(let l=0,u=o.length;l<u;l++){const f=o[l];this.addGroup(f.start,f.count,f.materialIndex)}const a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());const c=t.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const El=new re,Kn=new Cu,Vs=new ts,Tl=new k,Ws=new k,$s=new k,Xs=new k,uo=new k,Ys=new k,Al=new k,qs=new k;class tt extends Ae{constructor(t=new De,e=new es){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(s,t);const a=this.morphTargetInfluences;if(r&&a){Ys.set(0,0,0);for(let c=0,l=r.length;c<l;c++){const u=a[c],f=r[c];u!==0&&(uo.fromBufferAttribute(f,t),o?Ys.addScaledVector(uo,u):Ys.addScaledVector(uo.sub(e),u))}e.add(Ys)}return e}raycast(t,e){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Vs.copy(n.boundingSphere),Vs.applyMatrix4(r),Kn.copy(t.ray).recast(t.near),!(Vs.containsPoint(Kn.origin)===!1&&(Kn.intersectSphere(Vs,Tl)===null||Kn.origin.distanceToSquared(Tl)>(t.far-t.near)**2))&&(El.copy(r).invert(),Kn.copy(t.ray).applyMatrix4(El),!(n.boundingBox!==null&&Kn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Kn)))}_computeIntersections(t,e,n){let s;const r=this.geometry,o=this.material,a=r.index,c=r.attributes.position,l=r.attributes.uv,u=r.attributes.uv1,f=r.attributes.normal,d=r.groups,m=r.drawRange;if(a!==null)if(Array.isArray(o))for(let p=0,_=d.length;p<_;p++){const g=d[p],h=o[g.materialIndex],S=Math.max(g.start,m.start),b=Math.min(a.count,Math.min(g.start+g.count,m.start+m.count));for(let x=S,P=b;x<P;x+=3){const T=a.getX(x),C=a.getX(x+1),R=a.getX(x+2);s=Ks(this,h,t,n,l,u,f,T,C,R),s&&(s.faceIndex=Math.floor(x/3),s.face.materialIndex=g.materialIndex,e.push(s))}}else{const p=Math.max(0,m.start),_=Math.min(a.count,m.start+m.count);for(let g=p,h=_;g<h;g+=3){const S=a.getX(g),b=a.getX(g+1),x=a.getX(g+2);s=Ks(this,o,t,n,l,u,f,S,b,x),s&&(s.faceIndex=Math.floor(g/3),e.push(s))}}else if(c!==void 0)if(Array.isArray(o))for(let p=0,_=d.length;p<_;p++){const g=d[p],h=o[g.materialIndex],S=Math.max(g.start,m.start),b=Math.min(c.count,Math.min(g.start+g.count,m.start+m.count));for(let x=S,P=b;x<P;x+=3){const T=x,C=x+1,R=x+2;s=Ks(this,h,t,n,l,u,f,T,C,R),s&&(s.faceIndex=Math.floor(x/3),s.face.materialIndex=g.materialIndex,e.push(s))}}else{const p=Math.max(0,m.start),_=Math.min(c.count,m.start+m.count);for(let g=p,h=_;g<h;g+=3){const S=g,b=g+1,x=g+2;s=Ks(this,o,t,n,l,u,f,S,b,x),s&&(s.faceIndex=Math.floor(g/3),e.push(s))}}}}function Pf(i,t,e,n,s,r,o,a){let c;if(t.side===Be?c=n.intersectTriangle(o,r,s,!0,a):c=n.intersectTriangle(s,r,o,t.side===_n,a),c===null)return null;qs.copy(a),qs.applyMatrix4(i.matrixWorld);const l=e.ray.origin.distanceTo(qs);return l<e.near||l>e.far?null:{distance:l,point:qs.clone(),object:i}}function Ks(i,t,e,n,s,r,o,a,c,l){i.getVertexPosition(a,Ws),i.getVertexPosition(c,$s),i.getVertexPosition(l,Xs);const u=Pf(i,t,e,n,Ws,$s,Xs,Al);if(u){const f=new k;Je.getBarycoord(Al,Ws,$s,Xs,f),s&&(u.uv=Je.getInterpolatedAttribute(s,a,c,l,f,new Vt)),r&&(u.uv1=Je.getInterpolatedAttribute(r,a,c,l,f,new Vt)),o&&(u.normal=Je.getInterpolatedAttribute(o,a,c,l,f,new k),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));const d={a,b:c,c:l,normal:new k,materialIndex:0};Je.getNormal(Ws,$s,Xs,d.normal),u.face=d,u.barycoord=f}return u}class jt extends De{constructor(t=1,e=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};const a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);const c=[],l=[],u=[],f=[];let d=0,m=0;p("z","y","x",-1,-1,n,e,t,o,r,0),p("z","y","x",1,-1,n,e,-t,o,r,1),p("x","z","y",1,1,t,n,e,s,o,2),p("x","z","y",1,-1,t,n,-e,s,o,3),p("x","y","z",1,-1,t,e,n,s,r,4),p("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(c),this.setAttribute("position",new me(l,3)),this.setAttribute("normal",new me(u,3)),this.setAttribute("uv",new me(f,2));function p(_,g,h,S,b,x,P,T,C,R,y){const v=x/C,A=P/R,H=x/2,L=P/2,z=T/2,$=C+1,W=R+1;let Z=0,N=0;const at=new k;for(let mt=0;mt<W;mt++){const lt=mt*A-L;for(let ct=0;ct<$;ct++){const qt=ct*v-H;at[_]=qt*S,at[g]=lt*b,at[h]=z,l.push(at.x,at.y,at.z),at[_]=0,at[g]=0,at[h]=T>0?1:-1,u.push(at.x,at.y,at.z),f.push(ct/C),f.push(1-mt/R),Z+=1}}for(let mt=0;mt<R;mt++)for(let lt=0;lt<C;lt++){const ct=d+lt+$*mt,qt=d+lt+$*(mt+1),Y=d+(lt+1)+$*(mt+1),nt=d+(lt+1)+$*mt;c.push(ct,qt,nt),c.push(qt,Y,nt),N+=6}a.addGroup(m,N,y),m+=N,d+=Z}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new jt(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function Ki(i){const t={};for(const e in i){t[e]={};for(const n in i[e]){const s=i[e][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone():Array.isArray(s)?t[e][n]=s.slice():t[e][n]=s}}return t}function Fe(i){const t={};for(let e=0;e<i.length;e++){const n=Ki(i[e]);for(const s in n)t[s]=n[s]}return t}function Lf(i){const t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Uu(i){const t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Qt.workingColorSpace}const Nu={clone:Ki,merge:Fe};var Df=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Uf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Cn extends $n{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Df,this.fragmentShader=Uf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Ki(t.uniforms),this.uniformsGroups=Lf(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const s in this.uniforms){const o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class Fu extends Ae{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new re,this.projectionMatrix=new re,this.projectionMatrixInverse=new re,this.coordinateSystem=Tn}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const kn=new k,Rl=new Vt,Cl=new Vt;class Ze extends Fu{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=xa*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Wr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return xa*2*Math.atan(Math.tan(Wr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){kn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(kn.x,kn.y).multiplyScalar(-t/kn.z),kn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(kn.x,kn.y).multiplyScalar(-t/kn.z)}getViewSize(t,e){return this.getViewBounds(t,Rl,Cl),e.subVectors(Cl,Rl)}setViewOffset(t,e,n,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Wr*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s;const o=this.view;if(this.view!==null&&this.view.enabled){const c=o.fullWidth,l=o.fullHeight;r+=o.offsetX*s/c,e-=o.offsetY*n/l,s*=o.width/c,n*=o.height/l}const a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const Si=-90,wi=1;class Nf extends Ae{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Ze(Si,wi,t,e);s.layers=this.layers,this.add(s);const r=new Ze(Si,wi,t,e);r.layers=this.layers,this.add(r);const o=new Ze(Si,wi,t,e);o.layers=this.layers,this.add(o);const a=new Ze(Si,wi,t,e);a.layers=this.layers,this.add(a);const c=new Ze(Si,wi,t,e);c.layers=this.layers,this.add(c);const l=new Ze(Si,wi,t,e);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,s,r,o,a,c]=e;for(const l of e)this.remove(l);if(t===Tn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(t===Sr)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const l of e)this.add(l),l.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,o,a,c,l,u]=this.children,f=t.getRenderTarget(),d=t.getActiveCubeFace(),m=t.getActiveMipmapLevel(),p=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,s),t.render(e,r),t.setRenderTarget(n,1,s),t.render(e,o),t.setRenderTarget(n,2,s),t.render(e,a),t.setRenderTarget(n,3,s),t.render(e,c),t.setRenderTarget(n,4,s),t.render(e,l),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,s),t.render(e,u),t.setRenderTarget(f,d,m),t.xr.enabled=p,n.texture.needsPMREMUpdate=!0}}class Ou extends Te{constructor(t,e,n,s,r,o,a,c,l,u){t=t!==void 0?t:[],e=e!==void 0?e:$i,super(t,e,n,s,r,o,a,c,l,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class Ff extends ai{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new Ou(s,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:mn}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new jt(5,5,5),r=new Cn({name:"CubemapFromEquirect",uniforms:Ki(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Be,blending:Hn});r.uniforms.tEquirect.value=e;const o=new tt(s,r),a=e.minFilter;return e.minFilter===si&&(e.minFilter=mn),new Nf(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e,n,s){const r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,s);t.setRenderTarget(r)}}const ho=new k,Of=new k,Bf=new Gt;class Qn{constructor(t=new k(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const s=ho.subVectors(n,e).cross(Of.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(ho),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||Bf.getNormalMatrix(t),s=this.coplanarPoint(ho).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const jn=new ts,js=new k;class Ga{constructor(t=new Qn,e=new Qn,n=new Qn,s=new Qn,r=new Qn,o=new Qn){this.planes=[t,e,n,s,r,o]}set(t,e,n,s,r,o){const a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Tn){const n=this.planes,s=t.elements,r=s[0],o=s[1],a=s[2],c=s[3],l=s[4],u=s[5],f=s[6],d=s[7],m=s[8],p=s[9],_=s[10],g=s[11],h=s[12],S=s[13],b=s[14],x=s[15];if(n[0].setComponents(c-r,d-l,g-m,x-h).normalize(),n[1].setComponents(c+r,d+l,g+m,x+h).normalize(),n[2].setComponents(c+o,d+u,g+p,x+S).normalize(),n[3].setComponents(c-o,d-u,g-p,x-S).normalize(),n[4].setComponents(c-a,d-f,g-_,x-b).normalize(),e===Tn)n[5].setComponents(c+a,d+f,g+_,x+b).normalize();else if(e===Sr)n[5].setComponents(a,f,_,b).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),jn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),jn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(jn)}intersectsSprite(t){return jn.center.set(0,0,0),jn.radius=.7071067811865476,jn.applyMatrix4(t.matrixWorld),this.intersectsSphere(jn)}intersectsSphere(t){const e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const s=e[n];if(js.x=s.normal.x>0?t.max.x:t.min.x,js.y=s.normal.y>0?t.max.y:t.min.y,js.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(js)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Bu(){let i=null,t=!1,e=null,n=null;function s(r,o){e(r,o),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function kf(i){const t=new WeakMap;function e(a,c){const l=a.array,u=a.usage,f=l.byteLength,d=i.createBuffer();i.bindBuffer(c,d),i.bufferData(c,l,u),a.onUploadCallback();let m;if(l instanceof Float32Array)m=i.FLOAT;else if(l instanceof Uint16Array)a.isFloat16BufferAttribute?m=i.HALF_FLOAT:m=i.UNSIGNED_SHORT;else if(l instanceof Int16Array)m=i.SHORT;else if(l instanceof Uint32Array)m=i.UNSIGNED_INT;else if(l instanceof Int32Array)m=i.INT;else if(l instanceof Int8Array)m=i.BYTE;else if(l instanceof Uint8Array)m=i.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)m=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:d,type:m,bytesPerElement:l.BYTES_PER_ELEMENT,version:a.version,size:f}}function n(a,c,l){const u=c.array,f=c.updateRanges;if(i.bindBuffer(l,a),f.length===0)i.bufferSubData(l,0,u);else{f.sort((m,p)=>m.start-p.start);let d=0;for(let m=1;m<f.length;m++){const p=f[d],_=f[m];_.start<=p.start+p.count+1?p.count=Math.max(p.count,_.start+_.count-p.start):(++d,f[d]=_)}f.length=d+1;for(let m=0,p=f.length;m<p;m++){const _=f[m];i.bufferSubData(l,_.start*u.BYTES_PER_ELEMENT,u,_.start,_.count)}c.clearUpdateRanges()}c.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);const c=t.get(a);c&&(i.deleteBuffer(c.buffer),t.delete(a))}function o(a,c){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const u=t.get(a);(!u||u.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const l=t.get(a);if(l===void 0)t.set(a,e(a,c));else if(l.version<a.version){if(l.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,a,c),l.version=a.version}}return{get:s,remove:r,update:o}}class ve extends De{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};const r=t/2,o=e/2,a=Math.floor(n),c=Math.floor(s),l=a+1,u=c+1,f=t/a,d=e/c,m=[],p=[],_=[],g=[];for(let h=0;h<u;h++){const S=h*d-o;for(let b=0;b<l;b++){const x=b*f-r;p.push(x,-S,0),_.push(0,0,1),g.push(b/a),g.push(1-h/c)}}for(let h=0;h<c;h++)for(let S=0;S<a;S++){const b=S+l*h,x=S+l*(h+1),P=S+1+l*(h+1),T=S+1+l*h;m.push(b,x,T),m.push(x,P,T)}this.setIndex(m),this.setAttribute("position",new me(p,3)),this.setAttribute("normal",new me(_,3)),this.setAttribute("uv",new me(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ve(t.width,t.height,t.widthSegments,t.heightSegments)}}var zf=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Hf=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Gf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Vf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Wf=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,$f=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Xf=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Yf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,qf=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Kf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,jf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Zf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Jf=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Qf=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,td=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,ed=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,nd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,id=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,sd=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,rd=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,od=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,ad=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,ld=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,cd=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,ud=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,hd=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,fd=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,dd=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,pd=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,md=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,gd="gl_FragColor = linearToOutputTexel( gl_FragColor );",_d=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,vd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,xd=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Md=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,yd=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Sd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,wd=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,bd=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Ed=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Td=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Ad=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Rd=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Cd=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Id=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Pd=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Ld=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Dd=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Ud=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Nd=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Fd=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Od=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Bd=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,kd=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,zd=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Hd=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Gd=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Vd=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Wd=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,$d=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Xd=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Yd=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,qd=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Kd=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,jd=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Zd=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Jd=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Qd=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,tp=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,ep=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,np=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,ip=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,sp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,rp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,op=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,ap=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,lp=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,cp=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,up=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,hp=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,fp=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,dp=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,pp=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,mp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,gp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,_p=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,vp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,xp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Mp=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,yp=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Sp=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,wp=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,bp=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Ep=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Tp=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Ap=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Rp=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Cp=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Ip=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Pp=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Lp=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Dp=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Up=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Np=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Fp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Op=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Bp=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const kp=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,zp=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Hp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Gp=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Vp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Wp=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,$p=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Xp=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Yp=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,qp=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Kp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,jp=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Zp=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Jp=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Qp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,tm=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,em=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,nm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,im=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,sm=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,rm=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,om=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,am=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,lm=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,cm=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,um=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,hm=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,fm=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,dm=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,pm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,mm=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,gm=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,_m=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,vm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,$t={alphahash_fragment:zf,alphahash_pars_fragment:Hf,alphamap_fragment:Gf,alphamap_pars_fragment:Vf,alphatest_fragment:Wf,alphatest_pars_fragment:$f,aomap_fragment:Xf,aomap_pars_fragment:Yf,batching_pars_vertex:qf,batching_vertex:Kf,begin_vertex:jf,beginnormal_vertex:Zf,bsdfs:Jf,iridescence_fragment:Qf,bumpmap_pars_fragment:td,clipping_planes_fragment:ed,clipping_planes_pars_fragment:nd,clipping_planes_pars_vertex:id,clipping_planes_vertex:sd,color_fragment:rd,color_pars_fragment:od,color_pars_vertex:ad,color_vertex:ld,common:cd,cube_uv_reflection_fragment:ud,defaultnormal_vertex:hd,displacementmap_pars_vertex:fd,displacementmap_vertex:dd,emissivemap_fragment:pd,emissivemap_pars_fragment:md,colorspace_fragment:gd,colorspace_pars_fragment:_d,envmap_fragment:vd,envmap_common_pars_fragment:xd,envmap_pars_fragment:Md,envmap_pars_vertex:yd,envmap_physical_pars_fragment:Ld,envmap_vertex:Sd,fog_vertex:wd,fog_pars_vertex:bd,fog_fragment:Ed,fog_pars_fragment:Td,gradientmap_pars_fragment:Ad,lightmap_pars_fragment:Rd,lights_lambert_fragment:Cd,lights_lambert_pars_fragment:Id,lights_pars_begin:Pd,lights_toon_fragment:Dd,lights_toon_pars_fragment:Ud,lights_phong_fragment:Nd,lights_phong_pars_fragment:Fd,lights_physical_fragment:Od,lights_physical_pars_fragment:Bd,lights_fragment_begin:kd,lights_fragment_maps:zd,lights_fragment_end:Hd,logdepthbuf_fragment:Gd,logdepthbuf_pars_fragment:Vd,logdepthbuf_pars_vertex:Wd,logdepthbuf_vertex:$d,map_fragment:Xd,map_pars_fragment:Yd,map_particle_fragment:qd,map_particle_pars_fragment:Kd,metalnessmap_fragment:jd,metalnessmap_pars_fragment:Zd,morphinstance_vertex:Jd,morphcolor_vertex:Qd,morphnormal_vertex:tp,morphtarget_pars_vertex:ep,morphtarget_vertex:np,normal_fragment_begin:ip,normal_fragment_maps:sp,normal_pars_fragment:rp,normal_pars_vertex:op,normal_vertex:ap,normalmap_pars_fragment:lp,clearcoat_normal_fragment_begin:cp,clearcoat_normal_fragment_maps:up,clearcoat_pars_fragment:hp,iridescence_pars_fragment:fp,opaque_fragment:dp,packing:pp,premultiplied_alpha_fragment:mp,project_vertex:gp,dithering_fragment:_p,dithering_pars_fragment:vp,roughnessmap_fragment:xp,roughnessmap_pars_fragment:Mp,shadowmap_pars_fragment:yp,shadowmap_pars_vertex:Sp,shadowmap_vertex:wp,shadowmask_pars_fragment:bp,skinbase_vertex:Ep,skinning_pars_vertex:Tp,skinning_vertex:Ap,skinnormal_vertex:Rp,specularmap_fragment:Cp,specularmap_pars_fragment:Ip,tonemapping_fragment:Pp,tonemapping_pars_fragment:Lp,transmission_fragment:Dp,transmission_pars_fragment:Up,uv_pars_fragment:Np,uv_pars_vertex:Fp,uv_vertex:Op,worldpos_vertex:Bp,background_vert:kp,background_frag:zp,backgroundCube_vert:Hp,backgroundCube_frag:Gp,cube_vert:Vp,cube_frag:Wp,depth_vert:$p,depth_frag:Xp,distanceRGBA_vert:Yp,distanceRGBA_frag:qp,equirect_vert:Kp,equirect_frag:jp,linedashed_vert:Zp,linedashed_frag:Jp,meshbasic_vert:Qp,meshbasic_frag:tm,meshlambert_vert:em,meshlambert_frag:nm,meshmatcap_vert:im,meshmatcap_frag:sm,meshnormal_vert:rm,meshnormal_frag:om,meshphong_vert:am,meshphong_frag:lm,meshphysical_vert:cm,meshphysical_frag:um,meshtoon_vert:hm,meshtoon_frag:fm,points_vert:dm,points_frag:pm,shadow_vert:mm,shadow_frag:gm,sprite_vert:_m,sprite_frag:vm},ht={common:{diffuse:{value:new kt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Gt},alphaMap:{value:null},alphaMapTransform:{value:new Gt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Gt}},envmap:{envMap:{value:null},envMapRotation:{value:new Gt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Gt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Gt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Gt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Gt},normalScale:{value:new Vt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Gt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Gt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Gt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Gt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new kt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new kt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Gt},alphaTest:{value:0},uvTransform:{value:new Gt}},sprite:{diffuse:{value:new kt(16777215)},opacity:{value:1},center:{value:new Vt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Gt},alphaMap:{value:null},alphaMapTransform:{value:new Gt},alphaTest:{value:0}}},dn={basic:{uniforms:Fe([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.fog]),vertexShader:$t.meshbasic_vert,fragmentShader:$t.meshbasic_frag},lambert:{uniforms:Fe([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,ht.lights,{emissive:{value:new kt(0)}}]),vertexShader:$t.meshlambert_vert,fragmentShader:$t.meshlambert_frag},phong:{uniforms:Fe([ht.common,ht.specularmap,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,ht.lights,{emissive:{value:new kt(0)},specular:{value:new kt(1118481)},shininess:{value:30}}]),vertexShader:$t.meshphong_vert,fragmentShader:$t.meshphong_frag},standard:{uniforms:Fe([ht.common,ht.envmap,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.roughnessmap,ht.metalnessmap,ht.fog,ht.lights,{emissive:{value:new kt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:$t.meshphysical_vert,fragmentShader:$t.meshphysical_frag},toon:{uniforms:Fe([ht.common,ht.aomap,ht.lightmap,ht.emissivemap,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.gradientmap,ht.fog,ht.lights,{emissive:{value:new kt(0)}}]),vertexShader:$t.meshtoon_vert,fragmentShader:$t.meshtoon_frag},matcap:{uniforms:Fe([ht.common,ht.bumpmap,ht.normalmap,ht.displacementmap,ht.fog,{matcap:{value:null}}]),vertexShader:$t.meshmatcap_vert,fragmentShader:$t.meshmatcap_frag},points:{uniforms:Fe([ht.points,ht.fog]),vertexShader:$t.points_vert,fragmentShader:$t.points_frag},dashed:{uniforms:Fe([ht.common,ht.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:$t.linedashed_vert,fragmentShader:$t.linedashed_frag},depth:{uniforms:Fe([ht.common,ht.displacementmap]),vertexShader:$t.depth_vert,fragmentShader:$t.depth_frag},normal:{uniforms:Fe([ht.common,ht.bumpmap,ht.normalmap,ht.displacementmap,{opacity:{value:1}}]),vertexShader:$t.meshnormal_vert,fragmentShader:$t.meshnormal_frag},sprite:{uniforms:Fe([ht.sprite,ht.fog]),vertexShader:$t.sprite_vert,fragmentShader:$t.sprite_frag},background:{uniforms:{uvTransform:{value:new Gt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:$t.background_vert,fragmentShader:$t.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Gt}},vertexShader:$t.backgroundCube_vert,fragmentShader:$t.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:$t.cube_vert,fragmentShader:$t.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:$t.equirect_vert,fragmentShader:$t.equirect_frag},distanceRGBA:{uniforms:Fe([ht.common,ht.displacementmap,{referencePosition:{value:new k},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:$t.distanceRGBA_vert,fragmentShader:$t.distanceRGBA_frag},shadow:{uniforms:Fe([ht.lights,ht.fog,{color:{value:new kt(0)},opacity:{value:1}}]),vertexShader:$t.shadow_vert,fragmentShader:$t.shadow_frag}};dn.physical={uniforms:Fe([dn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Gt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Gt},clearcoatNormalScale:{value:new Vt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Gt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Gt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Gt},sheen:{value:0},sheenColor:{value:new kt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Gt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Gt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Gt},transmissionSamplerSize:{value:new Vt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Gt},attenuationDistance:{value:0},attenuationColor:{value:new kt(0)},specularColor:{value:new kt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Gt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Gt},anisotropyVector:{value:new Vt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Gt}}]),vertexShader:$t.meshphysical_vert,fragmentShader:$t.meshphysical_frag};const Zs={r:0,b:0,g:0},Zn=new an,xm=new re;function Mm(i,t,e,n,s,r,o){const a=new kt(0);let c=r===!0?0:1,l,u,f=null,d=0,m=null;function p(S){let b=S.isScene===!0?S.background:null;return b&&b.isTexture&&(b=(S.backgroundBlurriness>0?e:t).get(b)),b}function _(S){let b=!1;const x=p(S);x===null?h(a,c):x&&x.isColor&&(h(x,1),b=!0);const P=i.xr.getEnvironmentBlendMode();P==="additive"?n.buffers.color.setClear(0,0,0,1,o):P==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(i.autoClear||b)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function g(S,b){const x=p(b);x&&(x.isCubeTexture||x.mapping===Nr)?(u===void 0&&(u=new tt(new jt(1,1,1),new Cn({name:"BackgroundCubeMaterial",uniforms:Ki(dn.backgroundCube.uniforms),vertexShader:dn.backgroundCube.vertexShader,fragmentShader:dn.backgroundCube.fragmentShader,side:Be,depthTest:!1,depthWrite:!1,fog:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(P,T,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(u)),Zn.copy(b.backgroundRotation),Zn.x*=-1,Zn.y*=-1,Zn.z*=-1,x.isCubeTexture&&x.isRenderTargetTexture===!1&&(Zn.y*=-1,Zn.z*=-1),u.material.uniforms.envMap.value=x,u.material.uniforms.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=b.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(xm.makeRotationFromEuler(Zn)),u.material.toneMapped=Qt.getTransfer(x.colorSpace)!==oe,(f!==x||d!==x.version||m!==i.toneMapping)&&(u.material.needsUpdate=!0,f=x,d=x.version,m=i.toneMapping),u.layers.enableAll(),S.unshift(u,u.geometry,u.material,0,0,null)):x&&x.isTexture&&(l===void 0&&(l=new tt(new ve(2,2),new Cn({name:"BackgroundMaterial",uniforms:Ki(dn.background.uniforms),vertexShader:dn.background.vertexShader,fragmentShader:dn.background.fragmentShader,side:_n,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(l)),l.material.uniforms.t2D.value=x,l.material.uniforms.backgroundIntensity.value=b.backgroundIntensity,l.material.toneMapped=Qt.getTransfer(x.colorSpace)!==oe,x.matrixAutoUpdate===!0&&x.updateMatrix(),l.material.uniforms.uvTransform.value.copy(x.matrix),(f!==x||d!==x.version||m!==i.toneMapping)&&(l.material.needsUpdate=!0,f=x,d=x.version,m=i.toneMapping),l.layers.enableAll(),S.unshift(l,l.geometry,l.material,0,0,null))}function h(S,b){S.getRGB(Zs,Uu(i)),n.buffers.color.setClear(Zs.r,Zs.g,Zs.b,b,o)}return{getClearColor:function(){return a},setClearColor:function(S,b=1){a.set(S),c=b,h(a,c)},getClearAlpha:function(){return c},setClearAlpha:function(S){c=S,h(a,c)},render:_,addToRenderList:g}}function ym(i,t){const e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,o=!1;function a(v,A,H,L,z){let $=!1;const W=f(L,H,A);r!==W&&(r=W,l(r.object)),$=m(v,L,H,z),$&&p(v,L,H,z),z!==null&&t.update(z,i.ELEMENT_ARRAY_BUFFER),($||o)&&(o=!1,x(v,A,H,L),z!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(z).buffer))}function c(){return i.createVertexArray()}function l(v){return i.bindVertexArray(v)}function u(v){return i.deleteVertexArray(v)}function f(v,A,H){const L=H.wireframe===!0;let z=n[v.id];z===void 0&&(z={},n[v.id]=z);let $=z[A.id];$===void 0&&($={},z[A.id]=$);let W=$[L];return W===void 0&&(W=d(c()),$[L]=W),W}function d(v){const A=[],H=[],L=[];for(let z=0;z<e;z++)A[z]=0,H[z]=0,L[z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:A,enabledAttributes:H,attributeDivisors:L,object:v,attributes:{},index:null}}function m(v,A,H,L){const z=r.attributes,$=A.attributes;let W=0;const Z=H.getAttributes();for(const N in Z)if(Z[N].location>=0){const mt=z[N];let lt=$[N];if(lt===void 0&&(N==="instanceMatrix"&&v.instanceMatrix&&(lt=v.instanceMatrix),N==="instanceColor"&&v.instanceColor&&(lt=v.instanceColor)),mt===void 0||mt.attribute!==lt||lt&&mt.data!==lt.data)return!0;W++}return r.attributesNum!==W||r.index!==L}function p(v,A,H,L){const z={},$=A.attributes;let W=0;const Z=H.getAttributes();for(const N in Z)if(Z[N].location>=0){let mt=$[N];mt===void 0&&(N==="instanceMatrix"&&v.instanceMatrix&&(mt=v.instanceMatrix),N==="instanceColor"&&v.instanceColor&&(mt=v.instanceColor));const lt={};lt.attribute=mt,mt&&mt.data&&(lt.data=mt.data),z[N]=lt,W++}r.attributes=z,r.attributesNum=W,r.index=L}function _(){const v=r.newAttributes;for(let A=0,H=v.length;A<H;A++)v[A]=0}function g(v){h(v,0)}function h(v,A){const H=r.newAttributes,L=r.enabledAttributes,z=r.attributeDivisors;H[v]=1,L[v]===0&&(i.enableVertexAttribArray(v),L[v]=1),z[v]!==A&&(i.vertexAttribDivisor(v,A),z[v]=A)}function S(){const v=r.newAttributes,A=r.enabledAttributes;for(let H=0,L=A.length;H<L;H++)A[H]!==v[H]&&(i.disableVertexAttribArray(H),A[H]=0)}function b(v,A,H,L,z,$,W){W===!0?i.vertexAttribIPointer(v,A,H,z,$):i.vertexAttribPointer(v,A,H,L,z,$)}function x(v,A,H,L){_();const z=L.attributes,$=H.getAttributes(),W=A.defaultAttributeValues;for(const Z in $){const N=$[Z];if(N.location>=0){let at=z[Z];if(at===void 0&&(Z==="instanceMatrix"&&v.instanceMatrix&&(at=v.instanceMatrix),Z==="instanceColor"&&v.instanceColor&&(at=v.instanceColor)),at!==void 0){const mt=at.normalized,lt=at.itemSize,ct=t.get(at);if(ct===void 0)continue;const qt=ct.buffer,Y=ct.type,nt=ct.bytesPerElement,St=Y===i.INT||Y===i.UNSIGNED_INT||at.gpuType===Ua;if(at.isInterleavedBufferAttribute){const ft=at.data,Pt=ft.stride,Ct=at.offset;if(ft.isInstancedInterleavedBuffer){for(let It=0;It<N.locationSize;It++)h(N.location+It,ft.meshPerAttribute);v.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=ft.meshPerAttribute*ft.count)}else for(let It=0;It<N.locationSize;It++)g(N.location+It);i.bindBuffer(i.ARRAY_BUFFER,qt);for(let It=0;It<N.locationSize;It++)b(N.location+It,lt/N.locationSize,Y,mt,Pt*nt,(Ct+lt/N.locationSize*It)*nt,St)}else{if(at.isInstancedBufferAttribute){for(let ft=0;ft<N.locationSize;ft++)h(N.location+ft,at.meshPerAttribute);v.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=at.meshPerAttribute*at.count)}else for(let ft=0;ft<N.locationSize;ft++)g(N.location+ft);i.bindBuffer(i.ARRAY_BUFFER,qt);for(let ft=0;ft<N.locationSize;ft++)b(N.location+ft,lt/N.locationSize,Y,mt,lt*nt,lt/N.locationSize*ft*nt,St)}}else if(W!==void 0){const mt=W[Z];if(mt!==void 0)switch(mt.length){case 2:i.vertexAttrib2fv(N.location,mt);break;case 3:i.vertexAttrib3fv(N.location,mt);break;case 4:i.vertexAttrib4fv(N.location,mt);break;default:i.vertexAttrib1fv(N.location,mt)}}}}S()}function P(){R();for(const v in n){const A=n[v];for(const H in A){const L=A[H];for(const z in L)u(L[z].object),delete L[z];delete A[H]}delete n[v]}}function T(v){if(n[v.id]===void 0)return;const A=n[v.id];for(const H in A){const L=A[H];for(const z in L)u(L[z].object),delete L[z];delete A[H]}delete n[v.id]}function C(v){for(const A in n){const H=n[A];if(H[v.id]===void 0)continue;const L=H[v.id];for(const z in L)u(L[z].object),delete L[z];delete H[v.id]}}function R(){y(),o=!0,r!==s&&(r=s,l(r.object))}function y(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:R,resetDefaultState:y,dispose:P,releaseStatesOfGeometry:T,releaseStatesOfProgram:C,initAttributes:_,enableAttribute:g,disableUnusedAttributes:S}}function Sm(i,t,e){let n;function s(l){n=l}function r(l,u){i.drawArrays(n,l,u),e.update(u,n,1)}function o(l,u,f){f!==0&&(i.drawArraysInstanced(n,l,u,f),e.update(u,n,f))}function a(l,u,f){if(f===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,u,0,f);let m=0;for(let p=0;p<f;p++)m+=u[p];e.update(m,n,1)}function c(l,u,f,d){if(f===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let p=0;p<l.length;p++)o(l[p],u[p],d[p]);else{m.multiDrawArraysInstancedWEBGL(n,l,0,u,0,d,0,f);let p=0;for(let _=0;_<f;_++)p+=u[_]*d[_];e.update(p,n,1)}}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=c}function wm(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){const C=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(C){return!(C!==on&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(C){const R=C===Cs&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(C!==Rn&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&C!==gn&&!R)}function c(C){if(C==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=e.precision!==void 0?e.precision:"highp";const u=c(l);u!==l&&(console.warn("THREE.WebGLRenderer:",l,"not supported, using",u,"instead."),l=u);const f=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),m=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),p=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),g=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),h=i.getParameter(i.MAX_VERTEX_ATTRIBS),S=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),b=i.getParameter(i.MAX_VARYING_VECTORS),x=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),P=p>0,T=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:a,precision:l,logarithmicDepthBuffer:f,reverseDepthBuffer:d,maxTextures:m,maxVertexTextures:p,maxTextureSize:_,maxCubemapSize:g,maxAttributes:h,maxVertexUniforms:S,maxVaryings:b,maxFragmentUniforms:x,vertexTextures:P,maxSamples:T}}function bm(i){const t=this;let e=null,n=0,s=!1,r=!1;const o=new Qn,a=new Gt,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(f,d){const m=f.length!==0||d||n!==0||s;return s=d,n=f.length,m},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,d){e=u(f,d,0)},this.setState=function(f,d,m){const p=f.clippingPlanes,_=f.clipIntersection,g=f.clipShadows,h=i.get(f);if(!s||p===null||p.length===0||r&&!g)r?u(null):l();else{const S=r?0:n,b=S*4;let x=h.clippingState||null;c.value=x,x=u(p,d,b,m);for(let P=0;P!==b;++P)x[P]=e[P];h.clippingState=x,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=S}};function l(){c.value!==e&&(c.value=e,c.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function u(f,d,m,p){const _=f!==null?f.length:0;let g=null;if(_!==0){if(g=c.value,p!==!0||g===null){const h=m+_*4,S=d.matrixWorldInverse;a.getNormalMatrix(S),(g===null||g.length<h)&&(g=new Float32Array(h));for(let b=0,x=m;b!==_;++b,x+=4)o.copy(f[b]).applyMatrix4(S,a),o.normal.toArray(g,x),g[x+3]=o.constant}c.value=g,c.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,g}}function Em(i){let t=new WeakMap;function e(o,a){return a===Vo?o.mapping=$i:a===Wo&&(o.mapping=Xi),o}function n(o){if(o&&o.isTexture){const a=o.mapping;if(a===Vo||a===Wo)if(t.has(o)){const c=t.get(o).texture;return e(c,o.mapping)}else{const c=o.image;if(c&&c.height>0){const l=new Ff(c.height);return l.fromEquirectangularTexture(i,o),t.set(o,l),o.addEventListener("dispose",s),e(l.texture,o.mapping)}else return null}}return o}function s(o){const a=o.target;a.removeEventListener("dispose",s);const c=t.get(a);c!==void 0&&(t.delete(a),c.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class Tm extends Fu{constructor(t=-1,e=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-t,o=n+t,a=s+e,c=s-e;if(this.view!==null&&this.view.enabled){const l=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=l*this.view.offsetX,o=r+l*this.view.width,a-=u*this.view.offsetY,c=a-u*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,c,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const Ui=4,Il=[.125,.215,.35,.446,.526,.582],ni=20,fo=new Tm,Pl=new kt;let po=null,mo=0,go=0,_o=!1;const ti=(1+Math.sqrt(5))/2,bi=1/ti,Ll=[new k(-ti,bi,0),new k(ti,bi,0),new k(-bi,0,ti),new k(bi,0,ti),new k(0,ti,-bi),new k(0,ti,bi),new k(-1,1,-1),new k(1,1,-1),new k(-1,1,1),new k(1,1,1)];class Dl{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,s=100){po=this._renderer.getRenderTarget(),mo=this._renderer.getActiveCubeFace(),go=this._renderer.getActiveMipmapLevel(),_o=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,s,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Fl(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Nl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(po,mo,go),this._renderer.xr.enabled=_o,t.scissorTest=!1,Js(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===$i||t.mapping===Xi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),po=this._renderer.getRenderTarget(),mo=this._renderer.getActiveCubeFace(),go=this._renderer.getActiveMipmapLevel(),_o=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:mn,minFilter:mn,generateMipmaps:!1,type:Cs,format:on,colorSpace:Ji,depthBuffer:!1},s=Ul(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Ul(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Am(r)),this._blurMaterial=Rm(r,t,e)}return s}_compileMaterial(t){const e=new tt(this._lodPlanes[0],t);this._renderer.compile(e,fo)}_sceneToCubeUV(t,e,n,s){const a=new Ze(90,1,e,n),c=[1,-1,1,1,1,1],l=[1,1,1,-1,-1,-1],u=this._renderer,f=u.autoClear,d=u.toneMapping;u.getClearColor(Pl),u.toneMapping=Gn,u.autoClear=!1;const m=new es({name:"PMREM.Background",side:Be,depthWrite:!1,depthTest:!1}),p=new tt(new jt,m);let _=!1;const g=t.background;g?g.isColor&&(m.color.copy(g),t.background=null,_=!0):(m.color.copy(Pl),_=!0);for(let h=0;h<6;h++){const S=h%3;S===0?(a.up.set(0,c[h],0),a.lookAt(l[h],0,0)):S===1?(a.up.set(0,0,c[h]),a.lookAt(0,l[h],0)):(a.up.set(0,c[h],0),a.lookAt(0,0,l[h]));const b=this._cubeSize;Js(s,S*b,h>2?b:0,b,b),u.setRenderTarget(s),_&&u.render(p,a),u.render(t,a)}p.geometry.dispose(),p.material.dispose(),u.toneMapping=d,u.autoClear=f,t.background=g}_textureToCubeUV(t,e){const n=this._renderer,s=t.mapping===$i||t.mapping===Xi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Fl()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Nl());const r=s?this._cubemapMaterial:this._equirectMaterial,o=new tt(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=t;const c=this._cubeSize;Js(e,0,0,3*c,2*c),n.setRenderTarget(e),n.render(o,fo)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=Ll[(s-r-1)%Ll.length];this._blur(t,r-1,r,o,a)}e.autoClear=n}_blur(t,e,n,s,r){const o=this._pingPongRenderTarget;this._halfBlur(t,o,e,n,s,"latitudinal",r),this._halfBlur(o,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,o,a){const c=this._renderer,l=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,f=new tt(this._lodPlanes[s],l),d=l.uniforms,m=this._sizeLods[n]-1,p=isFinite(r)?Math.PI/(2*m):2*Math.PI/(2*ni-1),_=r/p,g=isFinite(r)?1+Math.floor(u*_):ni;g>ni&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${g} samples when the maximum is set to ${ni}`);const h=[];let S=0;for(let C=0;C<ni;++C){const R=C/_,y=Math.exp(-R*R/2);h.push(y),C===0?S+=y:C<g&&(S+=2*y)}for(let C=0;C<h.length;C++)h[C]=h[C]/S;d.envMap.value=t.texture,d.samples.value=g,d.weights.value=h,d.latitudinal.value=o==="latitudinal",a&&(d.poleAxis.value=a);const{_lodMax:b}=this;d.dTheta.value=p,d.mipInt.value=b-n;const x=this._sizeLods[s],P=3*x*(s>b-Ui?s-b+Ui:0),T=4*(this._cubeSize-x);Js(e,P,T,3*x,2*x),c.setRenderTarget(e),c.render(f,fo)}}function Am(i){const t=[],e=[],n=[];let s=i;const r=i-Ui+1+Il.length;for(let o=0;o<r;o++){const a=Math.pow(2,s);e.push(a);let c=1/a;o>i-Ui?c=Il[o-i+Ui-1]:o===0&&(c=0),n.push(c);const l=1/(a-2),u=-l,f=1+l,d=[u,u,f,u,f,f,u,u,f,f,u,f],m=6,p=6,_=3,g=2,h=1,S=new Float32Array(_*p*m),b=new Float32Array(g*p*m),x=new Float32Array(h*p*m);for(let T=0;T<m;T++){const C=T%3*2/3-1,R=T>2?0:-1,y=[C,R,0,C+2/3,R,0,C+2/3,R+1,0,C,R,0,C+2/3,R+1,0,C,R+1,0];S.set(y,_*p*T),b.set(d,g*p*T);const v=[T,T,T,T,T,T];x.set(v,h*p*T)}const P=new De;P.setAttribute("position",new Le(S,_)),P.setAttribute("uv",new Le(b,g)),P.setAttribute("faceIndex",new Le(x,h)),t.push(P),s>Ui&&s--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function Ul(i,t,e){const n=new ai(i,t,e);return n.texture.mapping=Nr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Js(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function Rm(i,t,e){const n=new Float32Array(ni),s=new k(0,1,0);return new Cn({name:"SphericalGaussianBlur",defines:{n:ni,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:Va(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Hn,depthTest:!1,depthWrite:!1})}function Nl(){return new Cn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Va(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Hn,depthTest:!1,depthWrite:!1})}function Fl(){return new Cn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Va(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Hn,depthTest:!1,depthWrite:!1})}function Va(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Cm(i){let t=new WeakMap,e=null;function n(a){if(a&&a.isTexture){const c=a.mapping,l=c===Vo||c===Wo,u=c===$i||c===Xi;if(l||u){let f=t.get(a);const d=f!==void 0?f.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==d)return e===null&&(e=new Dl(i)),f=l?e.fromEquirectangular(a,f):e.fromCubemap(a,f),f.texture.pmremVersion=a.pmremVersion,t.set(a,f),f.texture;if(f!==void 0)return f.texture;{const m=a.image;return l&&m&&m.height>0||u&&m&&s(m)?(e===null&&(e=new Dl(i)),f=l?e.fromEquirectangular(a):e.fromCubemap(a),f.texture.pmremVersion=a.pmremVersion,t.set(a,f),a.addEventListener("dispose",r),f.texture):null}}}return a}function s(a){let c=0;const l=6;for(let u=0;u<l;u++)a[u]!==void 0&&c++;return c===l}function r(a){const c=a.target;c.removeEventListener("dispose",r);const l=t.get(c);l!==void 0&&(t.delete(c),l.dispose())}function o(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:o}}function Im(i){const t={};function e(n){if(t[n]!==void 0)return t[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const s=e(n);return s===null&&ys("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function Pm(i,t,e,n){const s={},r=new WeakMap;function o(f){const d=f.target;d.index!==null&&t.remove(d.index);for(const p in d.attributes)t.remove(d.attributes[p]);for(const p in d.morphAttributes){const _=d.morphAttributes[p];for(let g=0,h=_.length;g<h;g++)t.remove(_[g])}d.removeEventListener("dispose",o),delete s[d.id];const m=r.get(d);m&&(t.remove(m),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function a(f,d){return s[d.id]===!0||(d.addEventListener("dispose",o),s[d.id]=!0,e.memory.geometries++),d}function c(f){const d=f.attributes;for(const p in d)t.update(d[p],i.ARRAY_BUFFER);const m=f.morphAttributes;for(const p in m){const _=m[p];for(let g=0,h=_.length;g<h;g++)t.update(_[g],i.ARRAY_BUFFER)}}function l(f){const d=[],m=f.index,p=f.attributes.position;let _=0;if(m!==null){const S=m.array;_=m.version;for(let b=0,x=S.length;b<x;b+=3){const P=S[b+0],T=S[b+1],C=S[b+2];d.push(P,T,T,C,C,P)}}else if(p!==void 0){const S=p.array;_=p.version;for(let b=0,x=S.length/3-1;b<x;b+=3){const P=b+0,T=b+1,C=b+2;d.push(P,T,T,C,C,P)}}else return;const g=new(Tu(d)?Du:Lu)(d,1);g.version=_;const h=r.get(f);h&&t.remove(h),r.set(f,g)}function u(f){const d=r.get(f);if(d){const m=f.index;m!==null&&d.version<m.version&&l(f)}else l(f);return r.get(f)}return{get:a,update:c,getWireframeAttribute:u}}function Lm(i,t,e){let n;function s(d){n=d}let r,o;function a(d){r=d.type,o=d.bytesPerElement}function c(d,m){i.drawElements(n,m,r,d*o),e.update(m,n,1)}function l(d,m,p){p!==0&&(i.drawElementsInstanced(n,m,r,d*o,p),e.update(m,n,p))}function u(d,m,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,m,0,r,d,0,p);let g=0;for(let h=0;h<p;h++)g+=m[h];e.update(g,n,1)}function f(d,m,p,_){if(p===0)return;const g=t.get("WEBGL_multi_draw");if(g===null)for(let h=0;h<d.length;h++)l(d[h]/o,m[h],_[h]);else{g.multiDrawElementsInstancedWEBGL(n,m,0,r,d,0,_,0,p);let h=0;for(let S=0;S<p;S++)h+=m[S]*_[S];e.update(h,n,1)}}this.setMode=s,this.setIndex=a,this.render=c,this.renderInstances=l,this.renderMultiDraw=u,this.renderMultiDrawInstances=f}function Dm(i){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(e.calls++,o){case i.TRIANGLES:e.triangles+=a*(r/3);break;case i.LINES:e.lines+=a*(r/2);break;case i.LINE_STRIP:e.lines+=a*(r-1);break;case i.LINE_LOOP:e.lines+=a*r;break;case i.POINTS:e.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function Um(i,t,e){const n=new WeakMap,s=new le;function r(o,a,c){const l=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=u!==void 0?u.length:0;let d=n.get(a);if(d===void 0||d.count!==f){let y=function(){C.dispose(),n.delete(a),a.removeEventListener("dispose",y)};d!==void 0&&d.texture.dispose();const m=a.morphAttributes.position!==void 0,p=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,g=a.morphAttributes.position||[],h=a.morphAttributes.normal||[],S=a.morphAttributes.color||[];let b=0;m===!0&&(b=1),p===!0&&(b=2),_===!0&&(b=3);let x=a.attributes.position.count*b,P=1;x>t.maxTextureSize&&(P=Math.ceil(x/t.maxTextureSize),x=t.maxTextureSize);const T=new Float32Array(x*P*4*f),C=new Ru(T,x,P,f);C.type=gn,C.needsUpdate=!0;const R=b*4;for(let v=0;v<f;v++){const A=g[v],H=h[v],L=S[v],z=x*P*4*v;for(let $=0;$<A.count;$++){const W=$*R;m===!0&&(s.fromBufferAttribute(A,$),T[z+W+0]=s.x,T[z+W+1]=s.y,T[z+W+2]=s.z,T[z+W+3]=0),p===!0&&(s.fromBufferAttribute(H,$),T[z+W+4]=s.x,T[z+W+5]=s.y,T[z+W+6]=s.z,T[z+W+7]=0),_===!0&&(s.fromBufferAttribute(L,$),T[z+W+8]=s.x,T[z+W+9]=s.y,T[z+W+10]=s.z,T[z+W+11]=L.itemSize===4?s.w:1)}}d={count:f,texture:C,size:new Vt(x,P)},n.set(a,d),a.addEventListener("dispose",y)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)c.getUniforms().setValue(i,"morphTexture",o.morphTexture,e);else{let m=0;for(let _=0;_<l.length;_++)m+=l[_];const p=a.morphTargetsRelative?1:1-m;c.getUniforms().setValue(i,"morphTargetBaseInfluence",p),c.getUniforms().setValue(i,"morphTargetInfluences",l)}c.getUniforms().setValue(i,"morphTargetsTexture",d.texture,e),c.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function Nm(i,t,e,n){let s=new WeakMap;function r(c){const l=n.render.frame,u=c.geometry,f=t.get(c,u);if(s.get(f)!==l&&(t.update(f),s.set(f,l)),c.isInstancedMesh&&(c.hasEventListener("dispose",a)===!1&&c.addEventListener("dispose",a),s.get(c)!==l&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),s.set(c,l))),c.isSkinnedMesh){const d=c.skeleton;s.get(d)!==l&&(d.update(),s.set(d,l))}return f}function o(){s=new WeakMap}function a(c){const l=c.target;l.removeEventListener("dispose",a),e.remove(l.instanceMatrix),l.instanceColor!==null&&e.remove(l.instanceColor)}return{update:r,dispose:o}}class ku extends Te{constructor(t,e,n,s,r,o,a,c,l,u=Bi){if(u!==Bi&&u!==qi)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&u===Bi&&(n=oi),n===void 0&&u===qi&&(n=Yi),super(null,s,r,o,a,c,u,n,l),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=a!==void 0?a:Nt,this.minFilter=c!==void 0?c:Nt,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const zu=new Te,Ol=new ku(1,1),Hu=new Ru,Gu=new yf,Vu=new Ou,Bl=[],kl=[],zl=new Float32Array(16),Hl=new Float32Array(9),Gl=new Float32Array(4);function ns(i,t,e){const n=i[0];if(n<=0||n>0)return i;const s=t*e;let r=Bl[s];if(r===void 0&&(r=new Float32Array(s),Bl[s]=r),t!==0){n.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,i[o].toArray(r,a)}return r}function we(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function be(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function Or(i,t){let e=kl[t];e===void 0&&(e=new Int32Array(t),kl[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function Fm(i,t){const e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function Om(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(we(e,t))return;i.uniform2fv(this.addr,t),be(e,t)}}function Bm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(we(e,t))return;i.uniform3fv(this.addr,t),be(e,t)}}function km(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(we(e,t))return;i.uniform4fv(this.addr,t),be(e,t)}}function zm(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(we(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),be(e,t)}else{if(we(e,n))return;Gl.set(n),i.uniformMatrix2fv(this.addr,!1,Gl),be(e,n)}}function Hm(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(we(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),be(e,t)}else{if(we(e,n))return;Hl.set(n),i.uniformMatrix3fv(this.addr,!1,Hl),be(e,n)}}function Gm(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(we(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),be(e,t)}else{if(we(e,n))return;zl.set(n),i.uniformMatrix4fv(this.addr,!1,zl),be(e,n)}}function Vm(i,t){const e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Wm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(we(e,t))return;i.uniform2iv(this.addr,t),be(e,t)}}function $m(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(we(e,t))return;i.uniform3iv(this.addr,t),be(e,t)}}function Xm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(we(e,t))return;i.uniform4iv(this.addr,t),be(e,t)}}function Ym(i,t){const e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function qm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(we(e,t))return;i.uniform2uiv(this.addr,t),be(e,t)}}function Km(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(we(e,t))return;i.uniform3uiv(this.addr,t),be(e,t)}}function jm(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(we(e,t))return;i.uniform4uiv(this.addr,t),be(e,t)}}function Zm(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Ol.compareFunction=Eu,r=Ol):r=zu,e.setTexture2D(t||r,s)}function Jm(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Gu,s)}function Qm(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||Vu,s)}function tg(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||Hu,s)}function eg(i){switch(i){case 5126:return Fm;case 35664:return Om;case 35665:return Bm;case 35666:return km;case 35674:return zm;case 35675:return Hm;case 35676:return Gm;case 5124:case 35670:return Vm;case 35667:case 35671:return Wm;case 35668:case 35672:return $m;case 35669:case 35673:return Xm;case 5125:return Ym;case 36294:return qm;case 36295:return Km;case 36296:return jm;case 35678:case 36198:case 36298:case 36306:case 35682:return Zm;case 35679:case 36299:case 36307:return Jm;case 35680:case 36300:case 36308:case 36293:return Qm;case 36289:case 36303:case 36311:case 36292:return tg}}function ng(i,t){i.uniform1fv(this.addr,t)}function ig(i,t){const e=ns(t,this.size,2);i.uniform2fv(this.addr,e)}function sg(i,t){const e=ns(t,this.size,3);i.uniform3fv(this.addr,e)}function rg(i,t){const e=ns(t,this.size,4);i.uniform4fv(this.addr,e)}function og(i,t){const e=ns(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function ag(i,t){const e=ns(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function lg(i,t){const e=ns(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function cg(i,t){i.uniform1iv(this.addr,t)}function ug(i,t){i.uniform2iv(this.addr,t)}function hg(i,t){i.uniform3iv(this.addr,t)}function fg(i,t){i.uniform4iv(this.addr,t)}function dg(i,t){i.uniform1uiv(this.addr,t)}function pg(i,t){i.uniform2uiv(this.addr,t)}function mg(i,t){i.uniform3uiv(this.addr,t)}function gg(i,t){i.uniform4uiv(this.addr,t)}function _g(i,t,e){const n=this.cache,s=t.length,r=Or(e,s);we(n,r)||(i.uniform1iv(this.addr,r),be(n,r));for(let o=0;o!==s;++o)e.setTexture2D(t[o]||zu,r[o])}function vg(i,t,e){const n=this.cache,s=t.length,r=Or(e,s);we(n,r)||(i.uniform1iv(this.addr,r),be(n,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||Gu,r[o])}function xg(i,t,e){const n=this.cache,s=t.length,r=Or(e,s);we(n,r)||(i.uniform1iv(this.addr,r),be(n,r));for(let o=0;o!==s;++o)e.setTextureCube(t[o]||Vu,r[o])}function Mg(i,t,e){const n=this.cache,s=t.length,r=Or(e,s);we(n,r)||(i.uniform1iv(this.addr,r),be(n,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||Hu,r[o])}function yg(i){switch(i){case 5126:return ng;case 35664:return ig;case 35665:return sg;case 35666:return rg;case 35674:return og;case 35675:return ag;case 35676:return lg;case 5124:case 35670:return cg;case 35667:case 35671:return ug;case 35668:case 35672:return hg;case 35669:case 35673:return fg;case 5125:return dg;case 36294:return pg;case 36295:return mg;case 36296:return gg;case 35678:case 36198:case 36298:case 36306:case 35682:return _g;case 35679:case 36299:case 36307:return vg;case 35680:case 36300:case 36308:case 36293:return xg;case 36289:case 36303:case 36311:case 36292:return Mg}}class Sg{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=eg(e.type)}}class wg{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=yg(e.type)}}class bg{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const s=this.seq;for(let r=0,o=s.length;r!==o;++r){const a=s[r];a.setValue(t,e[a.id],n)}}}const vo=/(\w+)(\])?(\[|\.)?/g;function Vl(i,t){i.seq.push(t),i.map[t.id]=t}function Eg(i,t,e){const n=i.name,s=n.length;for(vo.lastIndex=0;;){const r=vo.exec(n),o=vo.lastIndex;let a=r[1];const c=r[2]==="]",l=r[3];if(c&&(a=a|0),l===void 0||l==="["&&o+2===s){Vl(e,l===void 0?new Sg(a,i,t):new wg(a,i,t));break}else{let f=e.map[a];f===void 0&&(f=new bg(a),Vl(e,f)),e=f}}}class yr{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=t.getActiveUniform(e,s),o=t.getUniformLocation(e,r.name);Eg(r,o,this)}}setValue(t,e,n,s){const r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){const s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,o=e.length;r!==o;++r){const a=e[r],c=n[a.id];c.needsUpdate!==!1&&a.setValue(t,c.value,s)}}static seqWithValue(t,e){const n=[];for(let s=0,r=t.length;s!==r;++s){const o=t[s];o.id in e&&n.push(o)}return n}}function Wl(i,t,e){const n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}const Tg=37297;let Ag=0;function Rg(i,t){const e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){const a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}const $l=new Gt;function Cg(i){Qt._getMatrix($l,Qt.workingColorSpace,i);const t=`mat3( ${$l.elements.map(e=>e.toFixed(4))} )`;switch(Qt.getTransfer(i)){case Fr:return[t,"LinearTransferOETF"];case oe:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Xl(i,t,e){const n=i.getShaderParameter(t,i.COMPILE_STATUS),s=i.getShaderInfoLog(t).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const o=parseInt(r[1]);return e.toUpperCase()+`

`+s+`

`+Rg(i.getShaderSource(t),o)}else return s}function Ig(i,t){const e=Cg(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function Pg(i,t){let e;switch(t){case Yh:e="Linear";break;case qh:e="Reinhard";break;case Kh:e="Cineon";break;case jh:e="ACESFilmic";break;case Jh:e="AgX";break;case Qh:e="Neutral";break;case Zh:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const Qs=new k;function Lg(){Qt.getLuminanceCoefficients(Qs);const i=Qs.x.toFixed(4),t=Qs.y.toFixed(4),e=Qs.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Dg(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ss).join(`
`)}function Ug(i){const t=[];for(const e in i){const n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Ng(i,t){const e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(t,s),o=r.name;let a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:i.getAttribLocation(t,o),locationSize:a}}return e}function Ss(i){return i!==""}function Yl(i,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function ql(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const Fg=/^[ \t]*#include +<([\w\d./]+)>/gm;function Ma(i){return i.replace(Fg,Bg)}const Og=new Map;function Bg(i,t){let e=$t[t];if(e===void 0){const n=Og.get(t);if(n!==void 0)e=$t[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return Ma(e)}const kg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Kl(i){return i.replace(kg,zg)}function zg(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function jl(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Hg(i){let t="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===pu?t="SHADOWMAP_TYPE_PCF":i.shadowMapType===Th?t="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===En&&(t="SHADOWMAP_TYPE_VSM"),t}function Gg(i){let t="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case $i:case Xi:t="ENVMAP_TYPE_CUBE";break;case Nr:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Vg(i){let t="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case Xi:t="ENVMAP_MODE_REFRACTION";break}return t}function Wg(i){let t="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case Da:t="ENVMAP_BLENDING_MULTIPLY";break;case $h:t="ENVMAP_BLENDING_MIX";break;case Xh:t="ENVMAP_BLENDING_ADD";break}return t}function $g(i){const t=i.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Xg(i,t,e,n){const s=i.getContext(),r=e.defines;let o=e.vertexShader,a=e.fragmentShader;const c=Hg(e),l=Gg(e),u=Vg(e),f=Wg(e),d=$g(e),m=Dg(e),p=Ug(r),_=s.createProgram();let g,h,S=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(g=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,p].filter(Ss).join(`
`),g.length>0&&(g+=`
`),h=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,p].filter(Ss).join(`
`),h.length>0&&(h+=`
`)):(g=[jl(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,p,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+u:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ss).join(`
`),h=[jl(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,p,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+l:"",e.envMap?"#define "+u:"",e.envMap?"#define "+f:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Gn?"#define TONE_MAPPING":"",e.toneMapping!==Gn?$t.tonemapping_pars_fragment:"",e.toneMapping!==Gn?Pg("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",$t.colorspace_pars_fragment,Ig("linearToOutputTexel",e.outputColorSpace),Lg(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Ss).join(`
`)),o=Ma(o),o=Yl(o,e),o=ql(o,e),a=Ma(a),a=Yl(a,e),a=ql(a,e),o=Kl(o),a=Kl(a),e.isRawShaderMaterial!==!0&&(S=`#version 300 es
`,g=[m,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+g,h=["#define varying in",e.glslVersion===cl?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===cl?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+h);const b=S+g+o,x=S+h+a,P=Wl(s,s.VERTEX_SHADER,b),T=Wl(s,s.FRAGMENT_SHADER,x);s.attachShader(_,P),s.attachShader(_,T),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.morphTargets===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function C(A){if(i.debug.checkShaderErrors){const H=s.getProgramInfoLog(_).trim(),L=s.getShaderInfoLog(P).trim(),z=s.getShaderInfoLog(T).trim();let $=!0,W=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if($=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,P,T);else{const Z=Xl(s,P,"vertex"),N=Xl(s,T,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+A.name+`
Material Type: `+A.type+`

Program Info Log: `+H+`
`+Z+`
`+N)}else H!==""?console.warn("THREE.WebGLProgram: Program Info Log:",H):(L===""||z==="")&&(W=!1);W&&(A.diagnostics={runnable:$,programLog:H,vertexShader:{log:L,prefix:g},fragmentShader:{log:z,prefix:h}})}s.deleteShader(P),s.deleteShader(T),R=new yr(s,_),y=Ng(s,_)}let R;this.getUniforms=function(){return R===void 0&&C(this),R};let y;this.getAttributes=function(){return y===void 0&&C(this),y};let v=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return v===!1&&(v=s.getProgramParameter(_,Tg)),v},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=Ag++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=P,this.fragmentShader=T,this}let Yg=0;class qg{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,s=this._getShaderStage(e),r=this._getShaderStage(n),o=this._getShaderCacheForMaterial(t);return o.has(s)===!1&&(o.add(s),s.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new Kg(t),e.set(t,n)),n}}class Kg{constructor(t){this.id=Yg++,this.code=t,this.usedTimes=0}}function jg(i,t,e,n,s,r,o){const a=new Iu,c=new qg,l=new Set,u=[],f=s.logarithmicDepthBuffer,d=s.vertexTextures;let m=s.precision;const p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(y){return l.add(y),y===0?"uv":`uv${y}`}function g(y,v,A,H,L){const z=H.fog,$=L.geometry,W=y.isMeshStandardMaterial?H.environment:null,Z=(y.isMeshStandardMaterial?e:t).get(y.envMap||W),N=Z&&Z.mapping===Nr?Z.image.height:null,at=p[y.type];y.precision!==null&&(m=s.getMaxPrecision(y.precision),m!==y.precision&&console.warn("THREE.WebGLProgram.getParameters:",y.precision,"not supported, using",m,"instead."));const mt=$.morphAttributes.position||$.morphAttributes.normal||$.morphAttributes.color,lt=mt!==void 0?mt.length:0;let ct=0;$.morphAttributes.position!==void 0&&(ct=1),$.morphAttributes.normal!==void 0&&(ct=2),$.morphAttributes.color!==void 0&&(ct=3);let qt,Y,nt,St;if(at){const se=dn[at];qt=se.vertexShader,Y=se.fragmentShader}else qt=y.vertexShader,Y=y.fragmentShader,c.update(y),nt=c.getVertexShaderID(y),St=c.getFragmentShaderID(y);const ft=i.getRenderTarget(),Pt=i.state.buffers.depth.getReversed(),Ct=L.isInstancedMesh===!0,It=L.isBatchedMesh===!0,te=!!y.map,Xt=!!y.matcap,ge=!!Z,O=!!y.aoMap,Ue=!!y.lightMap,Yt=!!y.bumpMap,Kt=!!y.normalMap,Ut=!!y.displacementMap,ce=!!y.emissiveMap,Lt=!!y.metalnessMap,w=!!y.roughnessMap,M=y.anisotropy>0,D=y.clearcoat>0,K=y.dispersion>0,Q=y.iridescence>0,j=y.sheen>0,dt=y.transmission>0,rt=M&&!!y.anisotropyMap,pt=D&&!!y.clearcoatMap,Jt=D&&!!y.clearcoatNormalMap,st=D&&!!y.clearcoatRoughnessMap,Mt=Q&&!!y.iridescenceMap,Ft=Q&&!!y.iridescenceThicknessMap,Ot=j&&!!y.sheenColorMap,yt=j&&!!y.sheenRoughnessMap,Zt=!!y.specularMap,Wt=!!y.specularColorMap,ue=!!y.specularIntensityMap,U=dt&&!!y.transmissionMap,gt=dt&&!!y.thicknessMap,q=!!y.gradientMap,J=!!y.alphaMap,xt=y.alphaTest>0,_t=!!y.alphaHash,zt=!!y.extensions;let _e=Gn;y.toneMapped&&(ft===null||ft.isXRRenderTarget===!0)&&(_e=i.toneMapping);const Re={shaderID:at,shaderType:y.type,shaderName:y.name,vertexShader:qt,fragmentShader:Y,defines:y.defines,customVertexShaderID:nt,customFragmentShaderID:St,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:m,batching:It,batchingColor:It&&L._colorsTexture!==null,instancing:Ct,instancingColor:Ct&&L.instanceColor!==null,instancingMorph:Ct&&L.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:ft===null?i.outputColorSpace:ft.isXRRenderTarget===!0?ft.texture.colorSpace:Ji,alphaToCoverage:!!y.alphaToCoverage,map:te,matcap:Xt,envMap:ge,envMapMode:ge&&Z.mapping,envMapCubeUVHeight:N,aoMap:O,lightMap:Ue,bumpMap:Yt,normalMap:Kt,displacementMap:d&&Ut,emissiveMap:ce,normalMapObjectSpace:Kt&&y.normalMapType===sf,normalMapTangentSpace:Kt&&y.normalMapType===Ha,metalnessMap:Lt,roughnessMap:w,anisotropy:M,anisotropyMap:rt,clearcoat:D,clearcoatMap:pt,clearcoatNormalMap:Jt,clearcoatRoughnessMap:st,dispersion:K,iridescence:Q,iridescenceMap:Mt,iridescenceThicknessMap:Ft,sheen:j,sheenColorMap:Ot,sheenRoughnessMap:yt,specularMap:Zt,specularColorMap:Wt,specularIntensityMap:ue,transmission:dt,transmissionMap:U,thicknessMap:gt,gradientMap:q,opaque:y.transparent===!1&&y.blending===Oi&&y.alphaToCoverage===!1,alphaMap:J,alphaTest:xt,alphaHash:_t,combine:y.combine,mapUv:te&&_(y.map.channel),aoMapUv:O&&_(y.aoMap.channel),lightMapUv:Ue&&_(y.lightMap.channel),bumpMapUv:Yt&&_(y.bumpMap.channel),normalMapUv:Kt&&_(y.normalMap.channel),displacementMapUv:Ut&&_(y.displacementMap.channel),emissiveMapUv:ce&&_(y.emissiveMap.channel),metalnessMapUv:Lt&&_(y.metalnessMap.channel),roughnessMapUv:w&&_(y.roughnessMap.channel),anisotropyMapUv:rt&&_(y.anisotropyMap.channel),clearcoatMapUv:pt&&_(y.clearcoatMap.channel),clearcoatNormalMapUv:Jt&&_(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:st&&_(y.clearcoatRoughnessMap.channel),iridescenceMapUv:Mt&&_(y.iridescenceMap.channel),iridescenceThicknessMapUv:Ft&&_(y.iridescenceThicknessMap.channel),sheenColorMapUv:Ot&&_(y.sheenColorMap.channel),sheenRoughnessMapUv:yt&&_(y.sheenRoughnessMap.channel),specularMapUv:Zt&&_(y.specularMap.channel),specularColorMapUv:Wt&&_(y.specularColorMap.channel),specularIntensityMapUv:ue&&_(y.specularIntensityMap.channel),transmissionMapUv:U&&_(y.transmissionMap.channel),thicknessMapUv:gt&&_(y.thicknessMap.channel),alphaMapUv:J&&_(y.alphaMap.channel),vertexTangents:!!$.attributes.tangent&&(Kt||M),vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!$.attributes.color&&$.attributes.color.itemSize===4,pointsUvs:L.isPoints===!0&&!!$.attributes.uv&&(te||J),fog:!!z,useFog:y.fog===!0,fogExp2:!!z&&z.isFogExp2,flatShading:y.flatShading===!0,sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:f,reverseDepthBuffer:Pt,skinning:L.isSkinnedMesh===!0,morphTargets:$.morphAttributes.position!==void 0,morphNormals:$.morphAttributes.normal!==void 0,morphColors:$.morphAttributes.color!==void 0,morphTargetsCount:lt,morphTextureStride:ct,numDirLights:v.directional.length,numPointLights:v.point.length,numSpotLights:v.spot.length,numSpotLightMaps:v.spotLightMap.length,numRectAreaLights:v.rectArea.length,numHemiLights:v.hemi.length,numDirLightShadows:v.directionalShadowMap.length,numPointLightShadows:v.pointShadowMap.length,numSpotLightShadows:v.spotShadowMap.length,numSpotLightShadowsWithMaps:v.numSpotLightShadowsWithMaps,numLightProbes:v.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:y.dithering,shadowMapEnabled:i.shadowMap.enabled&&A.length>0,shadowMapType:i.shadowMap.type,toneMapping:_e,decodeVideoTexture:te&&y.map.isVideoTexture===!0&&Qt.getTransfer(y.map.colorSpace)===oe,decodeVideoTextureEmissive:ce&&y.emissiveMap.isVideoTexture===!0&&Qt.getTransfer(y.emissiveMap.colorSpace)===oe,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Pe,flipSided:y.side===Be,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:zt&&y.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(zt&&y.extensions.multiDraw===!0||It)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return Re.vertexUv1s=l.has(1),Re.vertexUv2s=l.has(2),Re.vertexUv3s=l.has(3),l.clear(),Re}function h(y){const v=[];if(y.shaderID?v.push(y.shaderID):(v.push(y.customVertexShaderID),v.push(y.customFragmentShaderID)),y.defines!==void 0)for(const A in y.defines)v.push(A),v.push(y.defines[A]);return y.isRawShaderMaterial===!1&&(S(v,y),b(v,y),v.push(i.outputColorSpace)),v.push(y.customProgramCacheKey),v.join()}function S(y,v){y.push(v.precision),y.push(v.outputColorSpace),y.push(v.envMapMode),y.push(v.envMapCubeUVHeight),y.push(v.mapUv),y.push(v.alphaMapUv),y.push(v.lightMapUv),y.push(v.aoMapUv),y.push(v.bumpMapUv),y.push(v.normalMapUv),y.push(v.displacementMapUv),y.push(v.emissiveMapUv),y.push(v.metalnessMapUv),y.push(v.roughnessMapUv),y.push(v.anisotropyMapUv),y.push(v.clearcoatMapUv),y.push(v.clearcoatNormalMapUv),y.push(v.clearcoatRoughnessMapUv),y.push(v.iridescenceMapUv),y.push(v.iridescenceThicknessMapUv),y.push(v.sheenColorMapUv),y.push(v.sheenRoughnessMapUv),y.push(v.specularMapUv),y.push(v.specularColorMapUv),y.push(v.specularIntensityMapUv),y.push(v.transmissionMapUv),y.push(v.thicknessMapUv),y.push(v.combine),y.push(v.fogExp2),y.push(v.sizeAttenuation),y.push(v.morphTargetsCount),y.push(v.morphAttributeCount),y.push(v.numDirLights),y.push(v.numPointLights),y.push(v.numSpotLights),y.push(v.numSpotLightMaps),y.push(v.numHemiLights),y.push(v.numRectAreaLights),y.push(v.numDirLightShadows),y.push(v.numPointLightShadows),y.push(v.numSpotLightShadows),y.push(v.numSpotLightShadowsWithMaps),y.push(v.numLightProbes),y.push(v.shadowMapType),y.push(v.toneMapping),y.push(v.numClippingPlanes),y.push(v.numClipIntersection),y.push(v.depthPacking)}function b(y,v){a.disableAll(),v.supportsVertexTextures&&a.enable(0),v.instancing&&a.enable(1),v.instancingColor&&a.enable(2),v.instancingMorph&&a.enable(3),v.matcap&&a.enable(4),v.envMap&&a.enable(5),v.normalMapObjectSpace&&a.enable(6),v.normalMapTangentSpace&&a.enable(7),v.clearcoat&&a.enable(8),v.iridescence&&a.enable(9),v.alphaTest&&a.enable(10),v.vertexColors&&a.enable(11),v.vertexAlphas&&a.enable(12),v.vertexUv1s&&a.enable(13),v.vertexUv2s&&a.enable(14),v.vertexUv3s&&a.enable(15),v.vertexTangents&&a.enable(16),v.anisotropy&&a.enable(17),v.alphaHash&&a.enable(18),v.batching&&a.enable(19),v.dispersion&&a.enable(20),v.batchingColor&&a.enable(21),y.push(a.mask),a.disableAll(),v.fog&&a.enable(0),v.useFog&&a.enable(1),v.flatShading&&a.enable(2),v.logarithmicDepthBuffer&&a.enable(3),v.reverseDepthBuffer&&a.enable(4),v.skinning&&a.enable(5),v.morphTargets&&a.enable(6),v.morphNormals&&a.enable(7),v.morphColors&&a.enable(8),v.premultipliedAlpha&&a.enable(9),v.shadowMapEnabled&&a.enable(10),v.doubleSided&&a.enable(11),v.flipSided&&a.enable(12),v.useDepthPacking&&a.enable(13),v.dithering&&a.enable(14),v.transmission&&a.enable(15),v.sheen&&a.enable(16),v.opaque&&a.enable(17),v.pointsUvs&&a.enable(18),v.decodeVideoTexture&&a.enable(19),v.decodeVideoTextureEmissive&&a.enable(20),v.alphaToCoverage&&a.enable(21),y.push(a.mask)}function x(y){const v=p[y.type];let A;if(v){const H=dn[v];A=Nu.clone(H.uniforms)}else A=y.uniforms;return A}function P(y,v){let A;for(let H=0,L=u.length;H<L;H++){const z=u[H];if(z.cacheKey===v){A=z,++A.usedTimes;break}}return A===void 0&&(A=new Xg(i,v,y,r),u.push(A)),A}function T(y){if(--y.usedTimes===0){const v=u.indexOf(y);u[v]=u[u.length-1],u.pop(),y.destroy()}}function C(y){c.remove(y)}function R(){c.dispose()}return{getParameters:g,getProgramCacheKey:h,getUniforms:x,acquireProgram:P,releaseProgram:T,releaseShaderCache:C,programs:u,dispose:R}}function Zg(){let i=new WeakMap;function t(o){return i.has(o)}function e(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,c){i.get(o)[a]=c}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Jg(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.z!==t.z?i.z-t.z:i.id-t.id}function Zl(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Jl(){const i=[];let t=0;const e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function o(f,d,m,p,_,g){let h=i[t];return h===void 0?(h={id:f.id,object:f,geometry:d,material:m,groupOrder:p,renderOrder:f.renderOrder,z:_,group:g},i[t]=h):(h.id=f.id,h.object=f,h.geometry=d,h.material=m,h.groupOrder=p,h.renderOrder=f.renderOrder,h.z=_,h.group=g),t++,h}function a(f,d,m,p,_,g){const h=o(f,d,m,p,_,g);m.transmission>0?n.push(h):m.transparent===!0?s.push(h):e.push(h)}function c(f,d,m,p,_,g){const h=o(f,d,m,p,_,g);m.transmission>0?n.unshift(h):m.transparent===!0?s.unshift(h):e.unshift(h)}function l(f,d){e.length>1&&e.sort(f||Jg),n.length>1&&n.sort(d||Zl),s.length>1&&s.sort(d||Zl)}function u(){for(let f=t,d=i.length;f<d;f++){const m=i[f];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:a,unshift:c,finish:u,sort:l}}function Qg(){let i=new WeakMap;function t(n,s){const r=i.get(n);let o;return r===void 0?(o=new Jl,i.set(n,[o])):s>=r.length?(o=new Jl,r.push(o)):o=r[s],o}function e(){i=new WeakMap}return{get:t,dispose:e}}function t0(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new k,color:new kt};break;case"SpotLight":e={position:new k,direction:new k,color:new kt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new k,color:new kt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new k,skyColor:new kt,groundColor:new kt};break;case"RectAreaLight":e={color:new kt,position:new k,halfWidth:new k,halfHeight:new k};break}return i[t.id]=e,e}}}function e0(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Vt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Vt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Vt,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}let n0=0;function i0(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function s0(i){const t=new t0,e=e0(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new k);const s=new k,r=new re,o=new re;function a(l){let u=0,f=0,d=0;for(let y=0;y<9;y++)n.probe[y].set(0,0,0);let m=0,p=0,_=0,g=0,h=0,S=0,b=0,x=0,P=0,T=0,C=0;l.sort(i0);for(let y=0,v=l.length;y<v;y++){const A=l[y],H=A.color,L=A.intensity,z=A.distance,$=A.shadow&&A.shadow.map?A.shadow.map.texture:null;if(A.isAmbientLight)u+=H.r*L,f+=H.g*L,d+=H.b*L;else if(A.isLightProbe){for(let W=0;W<9;W++)n.probe[W].addScaledVector(A.sh.coefficients[W],L);C++}else if(A.isDirectionalLight){const W=t.get(A);if(W.color.copy(A.color).multiplyScalar(A.intensity),A.castShadow){const Z=A.shadow,N=e.get(A);N.shadowIntensity=Z.intensity,N.shadowBias=Z.bias,N.shadowNormalBias=Z.normalBias,N.shadowRadius=Z.radius,N.shadowMapSize=Z.mapSize,n.directionalShadow[m]=N,n.directionalShadowMap[m]=$,n.directionalShadowMatrix[m]=A.shadow.matrix,S++}n.directional[m]=W,m++}else if(A.isSpotLight){const W=t.get(A);W.position.setFromMatrixPosition(A.matrixWorld),W.color.copy(H).multiplyScalar(L),W.distance=z,W.coneCos=Math.cos(A.angle),W.penumbraCos=Math.cos(A.angle*(1-A.penumbra)),W.decay=A.decay,n.spot[_]=W;const Z=A.shadow;if(A.map&&(n.spotLightMap[P]=A.map,P++,Z.updateMatrices(A),A.castShadow&&T++),n.spotLightMatrix[_]=Z.matrix,A.castShadow){const N=e.get(A);N.shadowIntensity=Z.intensity,N.shadowBias=Z.bias,N.shadowNormalBias=Z.normalBias,N.shadowRadius=Z.radius,N.shadowMapSize=Z.mapSize,n.spotShadow[_]=N,n.spotShadowMap[_]=$,x++}_++}else if(A.isRectAreaLight){const W=t.get(A);W.color.copy(H).multiplyScalar(L),W.halfWidth.set(A.width*.5,0,0),W.halfHeight.set(0,A.height*.5,0),n.rectArea[g]=W,g++}else if(A.isPointLight){const W=t.get(A);if(W.color.copy(A.color).multiplyScalar(A.intensity),W.distance=A.distance,W.decay=A.decay,A.castShadow){const Z=A.shadow,N=e.get(A);N.shadowIntensity=Z.intensity,N.shadowBias=Z.bias,N.shadowNormalBias=Z.normalBias,N.shadowRadius=Z.radius,N.shadowMapSize=Z.mapSize,N.shadowCameraNear=Z.camera.near,N.shadowCameraFar=Z.camera.far,n.pointShadow[p]=N,n.pointShadowMap[p]=$,n.pointShadowMatrix[p]=A.shadow.matrix,b++}n.point[p]=W,p++}else if(A.isHemisphereLight){const W=t.get(A);W.skyColor.copy(A.color).multiplyScalar(L),W.groundColor.copy(A.groundColor).multiplyScalar(L),n.hemi[h]=W,h++}}g>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ht.LTC_FLOAT_1,n.rectAreaLTC2=ht.LTC_FLOAT_2):(n.rectAreaLTC1=ht.LTC_HALF_1,n.rectAreaLTC2=ht.LTC_HALF_2)),n.ambient[0]=u,n.ambient[1]=f,n.ambient[2]=d;const R=n.hash;(R.directionalLength!==m||R.pointLength!==p||R.spotLength!==_||R.rectAreaLength!==g||R.hemiLength!==h||R.numDirectionalShadows!==S||R.numPointShadows!==b||R.numSpotShadows!==x||R.numSpotMaps!==P||R.numLightProbes!==C)&&(n.directional.length=m,n.spot.length=_,n.rectArea.length=g,n.point.length=p,n.hemi.length=h,n.directionalShadow.length=S,n.directionalShadowMap.length=S,n.pointShadow.length=b,n.pointShadowMap.length=b,n.spotShadow.length=x,n.spotShadowMap.length=x,n.directionalShadowMatrix.length=S,n.pointShadowMatrix.length=b,n.spotLightMatrix.length=x+P-T,n.spotLightMap.length=P,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=C,R.directionalLength=m,R.pointLength=p,R.spotLength=_,R.rectAreaLength=g,R.hemiLength=h,R.numDirectionalShadows=S,R.numPointShadows=b,R.numSpotShadows=x,R.numSpotMaps=P,R.numLightProbes=C,n.version=n0++)}function c(l,u){let f=0,d=0,m=0,p=0,_=0;const g=u.matrixWorldInverse;for(let h=0,S=l.length;h<S;h++){const b=l[h];if(b.isDirectionalLight){const x=n.directional[f];x.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),x.direction.sub(s),x.direction.transformDirection(g),f++}else if(b.isSpotLight){const x=n.spot[m];x.position.setFromMatrixPosition(b.matrixWorld),x.position.applyMatrix4(g),x.direction.setFromMatrixPosition(b.matrixWorld),s.setFromMatrixPosition(b.target.matrixWorld),x.direction.sub(s),x.direction.transformDirection(g),m++}else if(b.isRectAreaLight){const x=n.rectArea[p];x.position.setFromMatrixPosition(b.matrixWorld),x.position.applyMatrix4(g),o.identity(),r.copy(b.matrixWorld),r.premultiply(g),o.extractRotation(r),x.halfWidth.set(b.width*.5,0,0),x.halfHeight.set(0,b.height*.5,0),x.halfWidth.applyMatrix4(o),x.halfHeight.applyMatrix4(o),p++}else if(b.isPointLight){const x=n.point[d];x.position.setFromMatrixPosition(b.matrixWorld),x.position.applyMatrix4(g),d++}else if(b.isHemisphereLight){const x=n.hemi[_];x.direction.setFromMatrixPosition(b.matrixWorld),x.direction.transformDirection(g),_++}}}return{setup:a,setupView:c,state:n}}function Ql(i){const t=new s0(i),e=[],n=[];function s(u){l.camera=u,e.length=0,n.length=0}function r(u){e.push(u)}function o(u){n.push(u)}function a(){t.setup(e)}function c(u){t.setupView(e,u)}const l={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:s,state:l,setupLights:a,setupLightsView:c,pushLight:r,pushShadow:o}}function r0(i){let t=new WeakMap;function e(s,r=0){const o=t.get(s);let a;return o===void 0?(a=new Ql(i),t.set(s,[a])):r>=o.length?(a=new Ql(i),o.push(a)):a=o[r],a}function n(){t=new WeakMap}return{get:e,dispose:n}}class o0 extends $n{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=ef,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class a0 extends $n{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const l0=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,c0=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function u0(i,t,e){let n=new Ga;const s=new Vt,r=new Vt,o=new le,a=new o0({depthPacking:nf}),c=new a0,l={},u=e.maxTextureSize,f={[_n]:Be,[Be]:_n,[Pe]:Pe},d=new Cn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Vt},radius:{value:4}},vertexShader:l0,fragmentShader:c0}),m=d.clone();m.defines.HORIZONTAL_PASS=1;const p=new De;p.setAttribute("position",new Le(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new tt(p,d),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=pu;let h=this.type;this.render=function(T,C,R){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||T.length===0)return;const y=i.getRenderTarget(),v=i.getActiveCubeFace(),A=i.getActiveMipmapLevel(),H=i.state;H.setBlending(Hn),H.buffers.color.setClear(1,1,1,1),H.buffers.depth.setTest(!0),H.setScissorTest(!1);const L=h!==En&&this.type===En,z=h===En&&this.type!==En;for(let $=0,W=T.length;$<W;$++){const Z=T[$],N=Z.shadow;if(N===void 0){console.warn("THREE.WebGLShadowMap:",Z,"has no shadow.");continue}if(N.autoUpdate===!1&&N.needsUpdate===!1)continue;s.copy(N.mapSize);const at=N.getFrameExtents();if(s.multiply(at),r.copy(N.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/at.x),s.x=r.x*at.x,N.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/at.y),s.y=r.y*at.y,N.mapSize.y=r.y)),N.map===null||L===!0||z===!0){const lt=this.type!==En?{minFilter:Nt,magFilter:Nt}:{};N.map!==null&&N.map.dispose(),N.map=new ai(s.x,s.y,lt),N.map.texture.name=Z.name+".shadowMap",N.camera.updateProjectionMatrix()}i.setRenderTarget(N.map),i.clear();const mt=N.getViewportCount();for(let lt=0;lt<mt;lt++){const ct=N.getViewport(lt);o.set(r.x*ct.x,r.y*ct.y,r.x*ct.z,r.y*ct.w),H.viewport(o),N.updateMatrices(Z,lt),n=N.getFrustum(),x(C,R,N.camera,Z,this.type)}N.isPointLightShadow!==!0&&this.type===En&&S(N,R),N.needsUpdate=!1}h=this.type,g.needsUpdate=!1,i.setRenderTarget(y,v,A)};function S(T,C){const R=t.update(_);d.defines.VSM_SAMPLES!==T.blurSamples&&(d.defines.VSM_SAMPLES=T.blurSamples,m.defines.VSM_SAMPLES=T.blurSamples,d.needsUpdate=!0,m.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new ai(s.x,s.y)),d.uniforms.shadow_pass.value=T.map.texture,d.uniforms.resolution.value=T.mapSize,d.uniforms.radius.value=T.radius,i.setRenderTarget(T.mapPass),i.clear(),i.renderBufferDirect(C,null,R,d,_,null),m.uniforms.shadow_pass.value=T.mapPass.texture,m.uniforms.resolution.value=T.mapSize,m.uniforms.radius.value=T.radius,i.setRenderTarget(T.map),i.clear(),i.renderBufferDirect(C,null,R,m,_,null)}function b(T,C,R,y){let v=null;const A=R.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(A!==void 0)v=A;else if(v=R.isPointLight===!0?c:a,i.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0){const H=v.uuid,L=C.uuid;let z=l[H];z===void 0&&(z={},l[H]=z);let $=z[L];$===void 0&&($=v.clone(),z[L]=$,C.addEventListener("dispose",P)),v=$}if(v.visible=C.visible,v.wireframe=C.wireframe,y===En?v.side=C.shadowSide!==null?C.shadowSide:C.side:v.side=C.shadowSide!==null?C.shadowSide:f[C.side],v.alphaMap=C.alphaMap,v.alphaTest=C.alphaTest,v.map=C.map,v.clipShadows=C.clipShadows,v.clippingPlanes=C.clippingPlanes,v.clipIntersection=C.clipIntersection,v.displacementMap=C.displacementMap,v.displacementScale=C.displacementScale,v.displacementBias=C.displacementBias,v.wireframeLinewidth=C.wireframeLinewidth,v.linewidth=C.linewidth,R.isPointLight===!0&&v.isMeshDistanceMaterial===!0){const H=i.properties.get(v);H.light=R}return v}function x(T,C,R,y,v){if(T.visible===!1)return;if(T.layers.test(C.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&v===En)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(R.matrixWorldInverse,T.matrixWorld);const L=t.update(T),z=T.material;if(Array.isArray(z)){const $=L.groups;for(let W=0,Z=$.length;W<Z;W++){const N=$[W],at=z[N.materialIndex];if(at&&at.visible){const mt=b(T,at,y,v);T.onBeforeShadow(i,T,C,R,L,mt,N),i.renderBufferDirect(R,null,L,mt,T,N),T.onAfterShadow(i,T,C,R,L,mt,N)}}}else if(z.visible){const $=b(T,z,y,v);T.onBeforeShadow(i,T,C,R,L,$,null),i.renderBufferDirect(R,null,L,$,T,null),T.onAfterShadow(i,T,C,R,L,$,null)}}const H=T.children;for(let L=0,z=H.length;L<z;L++)x(H[L],C,R,y,v)}function P(T){T.target.removeEventListener("dispose",P);for(const R in l){const y=l[R],v=T.target.uuid;v in y&&(y[v].dispose(),delete y[v])}}}const h0={[Fo]:Oo,[Bo]:Ho,[ko]:Go,[Wi]:zo,[Oo]:Fo,[Ho]:Bo,[Go]:ko,[zo]:Wi};function f0(i,t){function e(){let U=!1;const gt=new le;let q=null;const J=new le(0,0,0,0);return{setMask:function(xt){q!==xt&&!U&&(i.colorMask(xt,xt,xt,xt),q=xt)},setLocked:function(xt){U=xt},setClear:function(xt,_t,zt,_e,Re){Re===!0&&(xt*=_e,_t*=_e,zt*=_e),gt.set(xt,_t,zt,_e),J.equals(gt)===!1&&(i.clearColor(xt,_t,zt,_e),J.copy(gt))},reset:function(){U=!1,q=null,J.set(-1,0,0,0)}}}function n(){let U=!1,gt=!1,q=null,J=null,xt=null;return{setReversed:function(_t){if(gt!==_t){const zt=t.get("EXT_clip_control");gt?zt.clipControlEXT(zt.LOWER_LEFT_EXT,zt.ZERO_TO_ONE_EXT):zt.clipControlEXT(zt.LOWER_LEFT_EXT,zt.NEGATIVE_ONE_TO_ONE_EXT);const _e=xt;xt=null,this.setClear(_e)}gt=_t},getReversed:function(){return gt},setTest:function(_t){_t?ft(i.DEPTH_TEST):Pt(i.DEPTH_TEST)},setMask:function(_t){q!==_t&&!U&&(i.depthMask(_t),q=_t)},setFunc:function(_t){if(gt&&(_t=h0[_t]),J!==_t){switch(_t){case Fo:i.depthFunc(i.NEVER);break;case Oo:i.depthFunc(i.ALWAYS);break;case Bo:i.depthFunc(i.LESS);break;case Wi:i.depthFunc(i.LEQUAL);break;case ko:i.depthFunc(i.EQUAL);break;case zo:i.depthFunc(i.GEQUAL);break;case Ho:i.depthFunc(i.GREATER);break;case Go:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}J=_t}},setLocked:function(_t){U=_t},setClear:function(_t){xt!==_t&&(gt&&(_t=1-_t),i.clearDepth(_t),xt=_t)},reset:function(){U=!1,q=null,J=null,xt=null,gt=!1}}}function s(){let U=!1,gt=null,q=null,J=null,xt=null,_t=null,zt=null,_e=null,Re=null;return{setTest:function(se){U||(se?ft(i.STENCIL_TEST):Pt(i.STENCIL_TEST))},setMask:function(se){gt!==se&&!U&&(i.stencilMask(se),gt=se)},setFunc:function(se,tn,vn){(q!==se||J!==tn||xt!==vn)&&(i.stencilFunc(se,tn,vn),q=se,J=tn,xt=vn)},setOp:function(se,tn,vn){(_t!==se||zt!==tn||_e!==vn)&&(i.stencilOp(se,tn,vn),_t=se,zt=tn,_e=vn)},setLocked:function(se){U=se},setClear:function(se){Re!==se&&(i.clearStencil(se),Re=se)},reset:function(){U=!1,gt=null,q=null,J=null,xt=null,_t=null,zt=null,_e=null,Re=null}}}const r=new e,o=new n,a=new s,c=new WeakMap,l=new WeakMap;let u={},f={},d=new WeakMap,m=[],p=null,_=!1,g=null,h=null,S=null,b=null,x=null,P=null,T=null,C=new kt(0,0,0),R=0,y=!1,v=null,A=null,H=null,L=null,z=null;const $=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let W=!1,Z=0;const N=i.getParameter(i.VERSION);N.indexOf("WebGL")!==-1?(Z=parseFloat(/^WebGL (\d)/.exec(N)[1]),W=Z>=1):N.indexOf("OpenGL ES")!==-1&&(Z=parseFloat(/^OpenGL ES (\d)/.exec(N)[1]),W=Z>=2);let at=null,mt={};const lt=i.getParameter(i.SCISSOR_BOX),ct=i.getParameter(i.VIEWPORT),qt=new le().fromArray(lt),Y=new le().fromArray(ct);function nt(U,gt,q,J){const xt=new Uint8Array(4),_t=i.createTexture();i.bindTexture(U,_t),i.texParameteri(U,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(U,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let zt=0;zt<q;zt++)U===i.TEXTURE_3D||U===i.TEXTURE_2D_ARRAY?i.texImage3D(gt,0,i.RGBA,1,1,J,0,i.RGBA,i.UNSIGNED_BYTE,xt):i.texImage2D(gt+zt,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,xt);return _t}const St={};St[i.TEXTURE_2D]=nt(i.TEXTURE_2D,i.TEXTURE_2D,1),St[i.TEXTURE_CUBE_MAP]=nt(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),St[i.TEXTURE_2D_ARRAY]=nt(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),St[i.TEXTURE_3D]=nt(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),ft(i.DEPTH_TEST),o.setFunc(Wi),Yt(!1),Kt(sl),ft(i.CULL_FACE),O(Hn);function ft(U){u[U]!==!0&&(i.enable(U),u[U]=!0)}function Pt(U){u[U]!==!1&&(i.disable(U),u[U]=!1)}function Ct(U,gt){return f[U]!==gt?(i.bindFramebuffer(U,gt),f[U]=gt,U===i.DRAW_FRAMEBUFFER&&(f[i.FRAMEBUFFER]=gt),U===i.FRAMEBUFFER&&(f[i.DRAW_FRAMEBUFFER]=gt),!0):!1}function It(U,gt){let q=m,J=!1;if(U){q=d.get(gt),q===void 0&&(q=[],d.set(gt,q));const xt=U.textures;if(q.length!==xt.length||q[0]!==i.COLOR_ATTACHMENT0){for(let _t=0,zt=xt.length;_t<zt;_t++)q[_t]=i.COLOR_ATTACHMENT0+_t;q.length=xt.length,J=!0}}else q[0]!==i.BACK&&(q[0]=i.BACK,J=!0);J&&i.drawBuffers(q)}function te(U){return p!==U?(i.useProgram(U),p=U,!0):!1}const Xt={[ei]:i.FUNC_ADD,[Rh]:i.FUNC_SUBTRACT,[Ch]:i.FUNC_REVERSE_SUBTRACT};Xt[Ih]=i.MIN,Xt[Ph]=i.MAX;const ge={[Lh]:i.ZERO,[Dh]:i.ONE,[Uh]:i.SRC_COLOR,[Uo]:i.SRC_ALPHA,[zh]:i.SRC_ALPHA_SATURATE,[Bh]:i.DST_COLOR,[Fh]:i.DST_ALPHA,[Nh]:i.ONE_MINUS_SRC_COLOR,[No]:i.ONE_MINUS_SRC_ALPHA,[kh]:i.ONE_MINUS_DST_COLOR,[Oh]:i.ONE_MINUS_DST_ALPHA,[Hh]:i.CONSTANT_COLOR,[Gh]:i.ONE_MINUS_CONSTANT_COLOR,[Vh]:i.CONSTANT_ALPHA,[Wh]:i.ONE_MINUS_CONSTANT_ALPHA};function O(U,gt,q,J,xt,_t,zt,_e,Re,se){if(U===Hn){_===!0&&(Pt(i.BLEND),_=!1);return}if(_===!1&&(ft(i.BLEND),_=!0),U!==Ah){if(U!==g||se!==y){if((h!==ei||x!==ei)&&(i.blendEquation(i.FUNC_ADD),h=ei,x=ei),se)switch(U){case Oi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case rl:i.blendFunc(i.ONE,i.ONE);break;case ol:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case al:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",U);break}else switch(U){case Oi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case rl:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case ol:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case al:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",U);break}S=null,b=null,P=null,T=null,C.set(0,0,0),R=0,g=U,y=se}return}xt=xt||gt,_t=_t||q,zt=zt||J,(gt!==h||xt!==x)&&(i.blendEquationSeparate(Xt[gt],Xt[xt]),h=gt,x=xt),(q!==S||J!==b||_t!==P||zt!==T)&&(i.blendFuncSeparate(ge[q],ge[J],ge[_t],ge[zt]),S=q,b=J,P=_t,T=zt),(_e.equals(C)===!1||Re!==R)&&(i.blendColor(_e.r,_e.g,_e.b,Re),C.copy(_e),R=Re),g=U,y=!1}function Ue(U,gt){U.side===Pe?Pt(i.CULL_FACE):ft(i.CULL_FACE);let q=U.side===Be;gt&&(q=!q),Yt(q),U.blending===Oi&&U.transparent===!1?O(Hn):O(U.blending,U.blendEquation,U.blendSrc,U.blendDst,U.blendEquationAlpha,U.blendSrcAlpha,U.blendDstAlpha,U.blendColor,U.blendAlpha,U.premultipliedAlpha),o.setFunc(U.depthFunc),o.setTest(U.depthTest),o.setMask(U.depthWrite),r.setMask(U.colorWrite);const J=U.stencilWrite;a.setTest(J),J&&(a.setMask(U.stencilWriteMask),a.setFunc(U.stencilFunc,U.stencilRef,U.stencilFuncMask),a.setOp(U.stencilFail,U.stencilZFail,U.stencilZPass)),ce(U.polygonOffset,U.polygonOffsetFactor,U.polygonOffsetUnits),U.alphaToCoverage===!0?ft(i.SAMPLE_ALPHA_TO_COVERAGE):Pt(i.SAMPLE_ALPHA_TO_COVERAGE)}function Yt(U){v!==U&&(U?i.frontFace(i.CW):i.frontFace(i.CCW),v=U)}function Kt(U){U!==bh?(ft(i.CULL_FACE),U!==A&&(U===sl?i.cullFace(i.BACK):U===Eh?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Pt(i.CULL_FACE),A=U}function Ut(U){U!==H&&(W&&i.lineWidth(U),H=U)}function ce(U,gt,q){U?(ft(i.POLYGON_OFFSET_FILL),(L!==gt||z!==q)&&(i.polygonOffset(gt,q),L=gt,z=q)):Pt(i.POLYGON_OFFSET_FILL)}function Lt(U){U?ft(i.SCISSOR_TEST):Pt(i.SCISSOR_TEST)}function w(U){U===void 0&&(U=i.TEXTURE0+$-1),at!==U&&(i.activeTexture(U),at=U)}function M(U,gt,q){q===void 0&&(at===null?q=i.TEXTURE0+$-1:q=at);let J=mt[q];J===void 0&&(J={type:void 0,texture:void 0},mt[q]=J),(J.type!==U||J.texture!==gt)&&(at!==q&&(i.activeTexture(q),at=q),i.bindTexture(U,gt||St[U]),J.type=U,J.texture=gt)}function D(){const U=mt[at];U!==void 0&&U.type!==void 0&&(i.bindTexture(U.type,null),U.type=void 0,U.texture=void 0)}function K(){try{i.compressedTexImage2D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function Q(){try{i.compressedTexImage3D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function j(){try{i.texSubImage2D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function dt(){try{i.texSubImage3D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function rt(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function pt(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function Jt(){try{i.texStorage2D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function st(){try{i.texStorage3D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function Mt(){try{i.texImage2D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function Ft(){try{i.texImage3D.apply(i,arguments)}catch(U){console.error("THREE.WebGLState:",U)}}function Ot(U){qt.equals(U)===!1&&(i.scissor(U.x,U.y,U.z,U.w),qt.copy(U))}function yt(U){Y.equals(U)===!1&&(i.viewport(U.x,U.y,U.z,U.w),Y.copy(U))}function Zt(U,gt){let q=l.get(gt);q===void 0&&(q=new WeakMap,l.set(gt,q));let J=q.get(U);J===void 0&&(J=i.getUniformBlockIndex(gt,U.name),q.set(U,J))}function Wt(U,gt){const J=l.get(gt).get(U);c.get(gt)!==J&&(i.uniformBlockBinding(gt,J,U.__bindingPointIndex),c.set(gt,J))}function ue(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),u={},at=null,mt={},f={},d=new WeakMap,m=[],p=null,_=!1,g=null,h=null,S=null,b=null,x=null,P=null,T=null,C=new kt(0,0,0),R=0,y=!1,v=null,A=null,H=null,L=null,z=null,qt.set(0,0,i.canvas.width,i.canvas.height),Y.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:ft,disable:Pt,bindFramebuffer:Ct,drawBuffers:It,useProgram:te,setBlending:O,setMaterial:Ue,setFlipSided:Yt,setCullFace:Kt,setLineWidth:Ut,setPolygonOffset:ce,setScissorTest:Lt,activeTexture:w,bindTexture:M,unbindTexture:D,compressedTexImage2D:K,compressedTexImage3D:Q,texImage2D:Mt,texImage3D:Ft,updateUBOMapping:Zt,uniformBlockBinding:Wt,texStorage2D:Jt,texStorage3D:st,texSubImage2D:j,texSubImage3D:dt,compressedTexSubImage2D:rt,compressedTexSubImage3D:pt,scissor:Ot,viewport:yt,reset:ue}}function tc(i,t,e,n){const s=d0(n);switch(e){case xu:return i*t;case yu:return i*t;case Su:return i*t*2;case Oa:return i*t/s.components*s.byteLength;case Ba:return i*t/s.components*s.byteLength;case wu:return i*t*2/s.components*s.byteLength;case ka:return i*t*2/s.components*s.byteLength;case Mu:return i*t*3/s.components*s.byteLength;case on:return i*t*4/s.components*s.byteLength;case za:return i*t*4/s.components*s.byteLength;case gr:case _r:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case vr:case xr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Yo:case Ko:return Math.max(i,16)*Math.max(t,8)/4;case Xo:case qo:return Math.max(i,8)*Math.max(t,8)/2;case jo:case Zo:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Jo:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Qo:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case ta:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case ea:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case na:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case ia:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case sa:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case ra:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case oa:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case aa:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case la:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case ca:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case ua:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case ha:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case fa:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Mr:case da:case pa:return Math.ceil(i/4)*Math.ceil(t/4)*16;case bu:case ma:return Math.ceil(i/4)*Math.ceil(t/4)*8;case ga:case _a:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function d0(i){switch(i){case Rn:case gu:return{byteLength:1,components:1};case bs:case _u:case Cs:return{byteLength:2,components:1};case Na:case Fa:return{byteLength:2,components:4};case oi:case Ua:case gn:return{byteLength:4,components:1};case vu:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function p0(i,t,e,n,s,r,o){const a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new Vt,u=new WeakMap;let f;const d=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function p(w,M){return m?new OffscreenCanvas(w,M):Es("canvas")}function _(w,M,D){let K=1;const Q=Lt(w);if((Q.width>D||Q.height>D)&&(K=D/Math.max(Q.width,Q.height)),K<1)if(typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&w instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&w instanceof ImageBitmap||typeof VideoFrame<"u"&&w instanceof VideoFrame){const j=Math.floor(K*Q.width),dt=Math.floor(K*Q.height);f===void 0&&(f=p(j,dt));const rt=M?p(j,dt):f;return rt.width=j,rt.height=dt,rt.getContext("2d").drawImage(w,0,0,j,dt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+Q.width+"x"+Q.height+") to ("+j+"x"+dt+")."),rt}else return"data"in w&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+Q.width+"x"+Q.height+")."),w;return w}function g(w){return w.generateMipmaps}function h(w){i.generateMipmap(w)}function S(w){return w.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:w.isWebGL3DRenderTarget?i.TEXTURE_3D:w.isWebGLArrayRenderTarget||w.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function b(w,M,D,K,Q=!1){if(w!==null){if(i[w]!==void 0)return i[w];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+w+"'")}let j=M;if(M===i.RED&&(D===i.FLOAT&&(j=i.R32F),D===i.HALF_FLOAT&&(j=i.R16F),D===i.UNSIGNED_BYTE&&(j=i.R8)),M===i.RED_INTEGER&&(D===i.UNSIGNED_BYTE&&(j=i.R8UI),D===i.UNSIGNED_SHORT&&(j=i.R16UI),D===i.UNSIGNED_INT&&(j=i.R32UI),D===i.BYTE&&(j=i.R8I),D===i.SHORT&&(j=i.R16I),D===i.INT&&(j=i.R32I)),M===i.RG&&(D===i.FLOAT&&(j=i.RG32F),D===i.HALF_FLOAT&&(j=i.RG16F),D===i.UNSIGNED_BYTE&&(j=i.RG8)),M===i.RG_INTEGER&&(D===i.UNSIGNED_BYTE&&(j=i.RG8UI),D===i.UNSIGNED_SHORT&&(j=i.RG16UI),D===i.UNSIGNED_INT&&(j=i.RG32UI),D===i.BYTE&&(j=i.RG8I),D===i.SHORT&&(j=i.RG16I),D===i.INT&&(j=i.RG32I)),M===i.RGB_INTEGER&&(D===i.UNSIGNED_BYTE&&(j=i.RGB8UI),D===i.UNSIGNED_SHORT&&(j=i.RGB16UI),D===i.UNSIGNED_INT&&(j=i.RGB32UI),D===i.BYTE&&(j=i.RGB8I),D===i.SHORT&&(j=i.RGB16I),D===i.INT&&(j=i.RGB32I)),M===i.RGBA_INTEGER&&(D===i.UNSIGNED_BYTE&&(j=i.RGBA8UI),D===i.UNSIGNED_SHORT&&(j=i.RGBA16UI),D===i.UNSIGNED_INT&&(j=i.RGBA32UI),D===i.BYTE&&(j=i.RGBA8I),D===i.SHORT&&(j=i.RGBA16I),D===i.INT&&(j=i.RGBA32I)),M===i.RGB&&D===i.UNSIGNED_INT_5_9_9_9_REV&&(j=i.RGB9_E5),M===i.RGBA){const dt=Q?Fr:Qt.getTransfer(K);D===i.FLOAT&&(j=i.RGBA32F),D===i.HALF_FLOAT&&(j=i.RGBA16F),D===i.UNSIGNED_BYTE&&(j=dt===oe?i.SRGB8_ALPHA8:i.RGBA8),D===i.UNSIGNED_SHORT_4_4_4_4&&(j=i.RGBA4),D===i.UNSIGNED_SHORT_5_5_5_1&&(j=i.RGB5_A1)}return(j===i.R16F||j===i.R32F||j===i.RG16F||j===i.RG32F||j===i.RGBA16F||j===i.RGBA32F)&&t.get("EXT_color_buffer_float"),j}function x(w,M){let D;return w?M===null||M===oi||M===Yi?D=i.DEPTH24_STENCIL8:M===gn?D=i.DEPTH32F_STENCIL8:M===bs&&(D=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):M===null||M===oi||M===Yi?D=i.DEPTH_COMPONENT24:M===gn?D=i.DEPTH_COMPONENT32F:M===bs&&(D=i.DEPTH_COMPONENT16),D}function P(w,M){return g(w)===!0||w.isFramebufferTexture&&w.minFilter!==Nt&&w.minFilter!==mn?Math.log2(Math.max(M.width,M.height))+1:w.mipmaps!==void 0&&w.mipmaps.length>0?w.mipmaps.length:w.isCompressedTexture&&Array.isArray(w.image)?M.mipmaps.length:1}function T(w){const M=w.target;M.removeEventListener("dispose",T),R(M),M.isVideoTexture&&u.delete(M)}function C(w){const M=w.target;M.removeEventListener("dispose",C),v(M)}function R(w){const M=n.get(w);if(M.__webglInit===void 0)return;const D=w.source,K=d.get(D);if(K){const Q=K[M.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&y(w),Object.keys(K).length===0&&d.delete(D)}n.remove(w)}function y(w){const M=n.get(w);i.deleteTexture(M.__webglTexture);const D=w.source,K=d.get(D);delete K[M.__cacheKey],o.memory.textures--}function v(w){const M=n.get(w);if(w.depthTexture&&(w.depthTexture.dispose(),n.remove(w.depthTexture)),w.isWebGLCubeRenderTarget)for(let K=0;K<6;K++){if(Array.isArray(M.__webglFramebuffer[K]))for(let Q=0;Q<M.__webglFramebuffer[K].length;Q++)i.deleteFramebuffer(M.__webglFramebuffer[K][Q]);else i.deleteFramebuffer(M.__webglFramebuffer[K]);M.__webglDepthbuffer&&i.deleteRenderbuffer(M.__webglDepthbuffer[K])}else{if(Array.isArray(M.__webglFramebuffer))for(let K=0;K<M.__webglFramebuffer.length;K++)i.deleteFramebuffer(M.__webglFramebuffer[K]);else i.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer&&i.deleteRenderbuffer(M.__webglDepthbuffer),M.__webglMultisampledFramebuffer&&i.deleteFramebuffer(M.__webglMultisampledFramebuffer),M.__webglColorRenderbuffer)for(let K=0;K<M.__webglColorRenderbuffer.length;K++)M.__webglColorRenderbuffer[K]&&i.deleteRenderbuffer(M.__webglColorRenderbuffer[K]);M.__webglDepthRenderbuffer&&i.deleteRenderbuffer(M.__webglDepthRenderbuffer)}const D=w.textures;for(let K=0,Q=D.length;K<Q;K++){const j=n.get(D[K]);j.__webglTexture&&(i.deleteTexture(j.__webglTexture),o.memory.textures--),n.remove(D[K])}n.remove(w)}let A=0;function H(){A=0}function L(){const w=A;return w>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+w+" texture units while this GPU supports only "+s.maxTextures),A+=1,w}function z(w){const M=[];return M.push(w.wrapS),M.push(w.wrapT),M.push(w.wrapR||0),M.push(w.magFilter),M.push(w.minFilter),M.push(w.anisotropy),M.push(w.internalFormat),M.push(w.format),M.push(w.type),M.push(w.generateMipmaps),M.push(w.premultiplyAlpha),M.push(w.flipY),M.push(w.unpackAlignment),M.push(w.colorSpace),M.join()}function $(w,M){const D=n.get(w);if(w.isVideoTexture&&Ut(w),w.isRenderTargetTexture===!1&&w.version>0&&D.__version!==w.version){const K=w.image;if(K===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(K.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Y(D,w,M);return}}e.bindTexture(i.TEXTURE_2D,D.__webglTexture,i.TEXTURE0+M)}function W(w,M){const D=n.get(w);if(w.version>0&&D.__version!==w.version){Y(D,w,M);return}e.bindTexture(i.TEXTURE_2D_ARRAY,D.__webglTexture,i.TEXTURE0+M)}function Z(w,M){const D=n.get(w);if(w.version>0&&D.__version!==w.version){Y(D,w,M);return}e.bindTexture(i.TEXTURE_3D,D.__webglTexture,i.TEXTURE0+M)}function N(w,M){const D=n.get(w);if(w.version>0&&D.__version!==w.version){nt(D,w,M);return}e.bindTexture(i.TEXTURE_CUBE_MAP,D.__webglTexture,i.TEXTURE0+M)}const at={[Ye]:i.REPEAT,[ii]:i.CLAMP_TO_EDGE,[$o]:i.MIRRORED_REPEAT},mt={[Nt]:i.NEAREST,[tf]:i.NEAREST_MIPMAP_NEAREST,[Ds]:i.NEAREST_MIPMAP_LINEAR,[mn]:i.LINEAR,[Vr]:i.LINEAR_MIPMAP_NEAREST,[si]:i.LINEAR_MIPMAP_LINEAR},lt={[rf]:i.NEVER,[hf]:i.ALWAYS,[of]:i.LESS,[Eu]:i.LEQUAL,[af]:i.EQUAL,[uf]:i.GEQUAL,[lf]:i.GREATER,[cf]:i.NOTEQUAL};function ct(w,M){if(M.type===gn&&t.has("OES_texture_float_linear")===!1&&(M.magFilter===mn||M.magFilter===Vr||M.magFilter===Ds||M.magFilter===si||M.minFilter===mn||M.minFilter===Vr||M.minFilter===Ds||M.minFilter===si)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(w,i.TEXTURE_WRAP_S,at[M.wrapS]),i.texParameteri(w,i.TEXTURE_WRAP_T,at[M.wrapT]),(w===i.TEXTURE_3D||w===i.TEXTURE_2D_ARRAY)&&i.texParameteri(w,i.TEXTURE_WRAP_R,at[M.wrapR]),i.texParameteri(w,i.TEXTURE_MAG_FILTER,mt[M.magFilter]),i.texParameteri(w,i.TEXTURE_MIN_FILTER,mt[M.minFilter]),M.compareFunction&&(i.texParameteri(w,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(w,i.TEXTURE_COMPARE_FUNC,lt[M.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===Nt||M.minFilter!==Ds&&M.minFilter!==si||M.type===gn&&t.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||n.get(M).__currentAnisotropy){const D=t.get("EXT_texture_filter_anisotropic");i.texParameterf(w,D.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,s.getMaxAnisotropy())),n.get(M).__currentAnisotropy=M.anisotropy}}}function qt(w,M){let D=!1;w.__webglInit===void 0&&(w.__webglInit=!0,M.addEventListener("dispose",T));const K=M.source;let Q=d.get(K);Q===void 0&&(Q={},d.set(K,Q));const j=z(M);if(j!==w.__cacheKey){Q[j]===void 0&&(Q[j]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,D=!0),Q[j].usedTimes++;const dt=Q[w.__cacheKey];dt!==void 0&&(Q[w.__cacheKey].usedTimes--,dt.usedTimes===0&&y(M)),w.__cacheKey=j,w.__webglTexture=Q[j].texture}return D}function Y(w,M,D){let K=i.TEXTURE_2D;(M.isDataArrayTexture||M.isCompressedArrayTexture)&&(K=i.TEXTURE_2D_ARRAY),M.isData3DTexture&&(K=i.TEXTURE_3D);const Q=qt(w,M),j=M.source;e.bindTexture(K,w.__webglTexture,i.TEXTURE0+D);const dt=n.get(j);if(j.version!==dt.__version||Q===!0){e.activeTexture(i.TEXTURE0+D);const rt=Qt.getPrimaries(Qt.workingColorSpace),pt=M.colorSpace===zn?null:Qt.getPrimaries(M.colorSpace),Jt=M.colorSpace===zn||rt===pt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,M.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,M.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Jt);let st=_(M.image,!1,s.maxTextureSize);st=ce(M,st);const Mt=r.convert(M.format,M.colorSpace),Ft=r.convert(M.type);let Ot=b(M.internalFormat,Mt,Ft,M.colorSpace,M.isVideoTexture);ct(K,M);let yt;const Zt=M.mipmaps,Wt=M.isVideoTexture!==!0,ue=dt.__version===void 0||Q===!0,U=j.dataReady,gt=P(M,st);if(M.isDepthTexture)Ot=x(M.format===qi,M.type),ue&&(Wt?e.texStorage2D(i.TEXTURE_2D,1,Ot,st.width,st.height):e.texImage2D(i.TEXTURE_2D,0,Ot,st.width,st.height,0,Mt,Ft,null));else if(M.isDataTexture)if(Zt.length>0){Wt&&ue&&e.texStorage2D(i.TEXTURE_2D,gt,Ot,Zt[0].width,Zt[0].height);for(let q=0,J=Zt.length;q<J;q++)yt=Zt[q],Wt?U&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,yt.width,yt.height,Mt,Ft,yt.data):e.texImage2D(i.TEXTURE_2D,q,Ot,yt.width,yt.height,0,Mt,Ft,yt.data);M.generateMipmaps=!1}else Wt?(ue&&e.texStorage2D(i.TEXTURE_2D,gt,Ot,st.width,st.height),U&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,st.width,st.height,Mt,Ft,st.data)):e.texImage2D(i.TEXTURE_2D,0,Ot,st.width,st.height,0,Mt,Ft,st.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){Wt&&ue&&e.texStorage3D(i.TEXTURE_2D_ARRAY,gt,Ot,Zt[0].width,Zt[0].height,st.depth);for(let q=0,J=Zt.length;q<J;q++)if(yt=Zt[q],M.format!==on)if(Mt!==null)if(Wt){if(U)if(M.layerUpdates.size>0){const xt=tc(yt.width,yt.height,M.format,M.type);for(const _t of M.layerUpdates){const zt=yt.data.subarray(_t*xt/yt.data.BYTES_PER_ELEMENT,(_t+1)*xt/yt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,_t,yt.width,yt.height,1,Mt,zt)}M.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,0,yt.width,yt.height,st.depth,Mt,yt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,q,Ot,yt.width,yt.height,st.depth,0,yt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Wt?U&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,q,0,0,0,yt.width,yt.height,st.depth,Mt,Ft,yt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,q,Ot,yt.width,yt.height,st.depth,0,Mt,Ft,yt.data)}else{Wt&&ue&&e.texStorage2D(i.TEXTURE_2D,gt,Ot,Zt[0].width,Zt[0].height);for(let q=0,J=Zt.length;q<J;q++)yt=Zt[q],M.format!==on?Mt!==null?Wt?U&&e.compressedTexSubImage2D(i.TEXTURE_2D,q,0,0,yt.width,yt.height,Mt,yt.data):e.compressedTexImage2D(i.TEXTURE_2D,q,Ot,yt.width,yt.height,0,yt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Wt?U&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,yt.width,yt.height,Mt,Ft,yt.data):e.texImage2D(i.TEXTURE_2D,q,Ot,yt.width,yt.height,0,Mt,Ft,yt.data)}else if(M.isDataArrayTexture)if(Wt){if(ue&&e.texStorage3D(i.TEXTURE_2D_ARRAY,gt,Ot,st.width,st.height,st.depth),U)if(M.layerUpdates.size>0){const q=tc(st.width,st.height,M.format,M.type);for(const J of M.layerUpdates){const xt=st.data.subarray(J*q/st.data.BYTES_PER_ELEMENT,(J+1)*q/st.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,J,st.width,st.height,1,Mt,Ft,xt)}M.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,st.width,st.height,st.depth,Mt,Ft,st.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,Ot,st.width,st.height,st.depth,0,Mt,Ft,st.data);else if(M.isData3DTexture)Wt?(ue&&e.texStorage3D(i.TEXTURE_3D,gt,Ot,st.width,st.height,st.depth),U&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,st.width,st.height,st.depth,Mt,Ft,st.data)):e.texImage3D(i.TEXTURE_3D,0,Ot,st.width,st.height,st.depth,0,Mt,Ft,st.data);else if(M.isFramebufferTexture){if(ue)if(Wt)e.texStorage2D(i.TEXTURE_2D,gt,Ot,st.width,st.height);else{let q=st.width,J=st.height;for(let xt=0;xt<gt;xt++)e.texImage2D(i.TEXTURE_2D,xt,Ot,q,J,0,Mt,Ft,null),q>>=1,J>>=1}}else if(Zt.length>0){if(Wt&&ue){const q=Lt(Zt[0]);e.texStorage2D(i.TEXTURE_2D,gt,Ot,q.width,q.height)}for(let q=0,J=Zt.length;q<J;q++)yt=Zt[q],Wt?U&&e.texSubImage2D(i.TEXTURE_2D,q,0,0,Mt,Ft,yt):e.texImage2D(i.TEXTURE_2D,q,Ot,Mt,Ft,yt);M.generateMipmaps=!1}else if(Wt){if(ue){const q=Lt(st);e.texStorage2D(i.TEXTURE_2D,gt,Ot,q.width,q.height)}U&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,Mt,Ft,st)}else e.texImage2D(i.TEXTURE_2D,0,Ot,Mt,Ft,st);g(M)&&h(K),dt.__version=j.version,M.onUpdate&&M.onUpdate(M)}w.__version=M.version}function nt(w,M,D){if(M.image.length!==6)return;const K=qt(w,M),Q=M.source;e.bindTexture(i.TEXTURE_CUBE_MAP,w.__webglTexture,i.TEXTURE0+D);const j=n.get(Q);if(Q.version!==j.__version||K===!0){e.activeTexture(i.TEXTURE0+D);const dt=Qt.getPrimaries(Qt.workingColorSpace),rt=M.colorSpace===zn?null:Qt.getPrimaries(M.colorSpace),pt=M.colorSpace===zn||dt===rt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,M.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,M.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,pt);const Jt=M.isCompressedTexture||M.image[0].isCompressedTexture,st=M.image[0]&&M.image[0].isDataTexture,Mt=[];for(let J=0;J<6;J++)!Jt&&!st?Mt[J]=_(M.image[J],!0,s.maxCubemapSize):Mt[J]=st?M.image[J].image:M.image[J],Mt[J]=ce(M,Mt[J]);const Ft=Mt[0],Ot=r.convert(M.format,M.colorSpace),yt=r.convert(M.type),Zt=b(M.internalFormat,Ot,yt,M.colorSpace),Wt=M.isVideoTexture!==!0,ue=j.__version===void 0||K===!0,U=Q.dataReady;let gt=P(M,Ft);ct(i.TEXTURE_CUBE_MAP,M);let q;if(Jt){Wt&&ue&&e.texStorage2D(i.TEXTURE_CUBE_MAP,gt,Zt,Ft.width,Ft.height);for(let J=0;J<6;J++){q=Mt[J].mipmaps;for(let xt=0;xt<q.length;xt++){const _t=q[xt];M.format!==on?Ot!==null?Wt?U&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,xt,0,0,_t.width,_t.height,Ot,_t.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,xt,Zt,_t.width,_t.height,0,_t.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Wt?U&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,xt,0,0,_t.width,_t.height,Ot,yt,_t.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,xt,Zt,_t.width,_t.height,0,Ot,yt,_t.data)}}}else{if(q=M.mipmaps,Wt&&ue){q.length>0&&gt++;const J=Lt(Mt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,gt,Zt,J.width,J.height)}for(let J=0;J<6;J++)if(st){Wt?U&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,0,0,Mt[J].width,Mt[J].height,Ot,yt,Mt[J].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,Zt,Mt[J].width,Mt[J].height,0,Ot,yt,Mt[J].data);for(let xt=0;xt<q.length;xt++){const zt=q[xt].image[J].image;Wt?U&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,xt+1,0,0,zt.width,zt.height,Ot,yt,zt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,xt+1,Zt,zt.width,zt.height,0,Ot,yt,zt.data)}}else{Wt?U&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,0,0,Ot,yt,Mt[J]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,0,Zt,Ot,yt,Mt[J]);for(let xt=0;xt<q.length;xt++){const _t=q[xt];Wt?U&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,xt+1,0,0,Ot,yt,_t.image[J]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+J,xt+1,Zt,Ot,yt,_t.image[J])}}}g(M)&&h(i.TEXTURE_CUBE_MAP),j.__version=Q.version,M.onUpdate&&M.onUpdate(M)}w.__version=M.version}function St(w,M,D,K,Q,j){const dt=r.convert(D.format,D.colorSpace),rt=r.convert(D.type),pt=b(D.internalFormat,dt,rt,D.colorSpace),Jt=n.get(M),st=n.get(D);if(st.__renderTarget=M,!Jt.__hasExternalTextures){const Mt=Math.max(1,M.width>>j),Ft=Math.max(1,M.height>>j);Q===i.TEXTURE_3D||Q===i.TEXTURE_2D_ARRAY?e.texImage3D(Q,j,pt,Mt,Ft,M.depth,0,dt,rt,null):e.texImage2D(Q,j,pt,Mt,Ft,0,dt,rt,null)}e.bindFramebuffer(i.FRAMEBUFFER,w),Kt(M)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,K,Q,st.__webglTexture,0,Yt(M)):(Q===i.TEXTURE_2D||Q>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,K,Q,st.__webglTexture,j),e.bindFramebuffer(i.FRAMEBUFFER,null)}function ft(w,M,D){if(i.bindRenderbuffer(i.RENDERBUFFER,w),M.depthBuffer){const K=M.depthTexture,Q=K&&K.isDepthTexture?K.type:null,j=x(M.stencilBuffer,Q),dt=M.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,rt=Yt(M);Kt(M)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,rt,j,M.width,M.height):D?i.renderbufferStorageMultisample(i.RENDERBUFFER,rt,j,M.width,M.height):i.renderbufferStorage(i.RENDERBUFFER,j,M.width,M.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,dt,i.RENDERBUFFER,w)}else{const K=M.textures;for(let Q=0;Q<K.length;Q++){const j=K[Q],dt=r.convert(j.format,j.colorSpace),rt=r.convert(j.type),pt=b(j.internalFormat,dt,rt,j.colorSpace),Jt=Yt(M);D&&Kt(M)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,Jt,pt,M.width,M.height):Kt(M)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Jt,pt,M.width,M.height):i.renderbufferStorage(i.RENDERBUFFER,pt,M.width,M.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Pt(w,M){if(M&&M.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(i.FRAMEBUFFER,w),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const K=n.get(M.depthTexture);K.__renderTarget=M,(!K.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)&&(M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0),$(M.depthTexture,0);const Q=K.__webglTexture,j=Yt(M);if(M.depthTexture.format===Bi)Kt(M)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,Q,0,j):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,Q,0);else if(M.depthTexture.format===qi)Kt(M)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,Q,0,j):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,Q,0);else throw new Error("Unknown depthTexture format")}function Ct(w){const M=n.get(w),D=w.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==w.depthTexture){const K=w.depthTexture;if(M.__depthDisposeCallback&&M.__depthDisposeCallback(),K){const Q=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,K.removeEventListener("dispose",Q)};K.addEventListener("dispose",Q),M.__depthDisposeCallback=Q}M.__boundDepthTexture=K}if(w.depthTexture&&!M.__autoAllocateDepthBuffer){if(D)throw new Error("target.depthTexture not supported in Cube render targets");Pt(M.__webglFramebuffer,w)}else if(D){M.__webglDepthbuffer=[];for(let K=0;K<6;K++)if(e.bindFramebuffer(i.FRAMEBUFFER,M.__webglFramebuffer[K]),M.__webglDepthbuffer[K]===void 0)M.__webglDepthbuffer[K]=i.createRenderbuffer(),ft(M.__webglDepthbuffer[K],w,!1);else{const Q=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,j=M.__webglDepthbuffer[K];i.bindRenderbuffer(i.RENDERBUFFER,j),i.framebufferRenderbuffer(i.FRAMEBUFFER,Q,i.RENDERBUFFER,j)}}else if(e.bindFramebuffer(i.FRAMEBUFFER,M.__webglFramebuffer),M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=i.createRenderbuffer(),ft(M.__webglDepthbuffer,w,!1);else{const K=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,Q=M.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,Q),i.framebufferRenderbuffer(i.FRAMEBUFFER,K,i.RENDERBUFFER,Q)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function It(w,M,D){const K=n.get(w);M!==void 0&&St(K.__webglFramebuffer,w,w.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),D!==void 0&&Ct(w)}function te(w){const M=w.texture,D=n.get(w),K=n.get(M);w.addEventListener("dispose",C);const Q=w.textures,j=w.isWebGLCubeRenderTarget===!0,dt=Q.length>1;if(dt||(K.__webglTexture===void 0&&(K.__webglTexture=i.createTexture()),K.__version=M.version,o.memory.textures++),j){D.__webglFramebuffer=[];for(let rt=0;rt<6;rt++)if(M.mipmaps&&M.mipmaps.length>0){D.__webglFramebuffer[rt]=[];for(let pt=0;pt<M.mipmaps.length;pt++)D.__webglFramebuffer[rt][pt]=i.createFramebuffer()}else D.__webglFramebuffer[rt]=i.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){D.__webglFramebuffer=[];for(let rt=0;rt<M.mipmaps.length;rt++)D.__webglFramebuffer[rt]=i.createFramebuffer()}else D.__webglFramebuffer=i.createFramebuffer();if(dt)for(let rt=0,pt=Q.length;rt<pt;rt++){const Jt=n.get(Q[rt]);Jt.__webglTexture===void 0&&(Jt.__webglTexture=i.createTexture(),o.memory.textures++)}if(w.samples>0&&Kt(w)===!1){D.__webglMultisampledFramebuffer=i.createFramebuffer(),D.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,D.__webglMultisampledFramebuffer);for(let rt=0;rt<Q.length;rt++){const pt=Q[rt];D.__webglColorRenderbuffer[rt]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,D.__webglColorRenderbuffer[rt]);const Jt=r.convert(pt.format,pt.colorSpace),st=r.convert(pt.type),Mt=b(pt.internalFormat,Jt,st,pt.colorSpace,w.isXRRenderTarget===!0),Ft=Yt(w);i.renderbufferStorageMultisample(i.RENDERBUFFER,Ft,Mt,w.width,w.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+rt,i.RENDERBUFFER,D.__webglColorRenderbuffer[rt])}i.bindRenderbuffer(i.RENDERBUFFER,null),w.depthBuffer&&(D.__webglDepthRenderbuffer=i.createRenderbuffer(),ft(D.__webglDepthRenderbuffer,w,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(j){e.bindTexture(i.TEXTURE_CUBE_MAP,K.__webglTexture),ct(i.TEXTURE_CUBE_MAP,M);for(let rt=0;rt<6;rt++)if(M.mipmaps&&M.mipmaps.length>0)for(let pt=0;pt<M.mipmaps.length;pt++)St(D.__webglFramebuffer[rt][pt],w,M,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,pt);else St(D.__webglFramebuffer[rt],w,M,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0);g(M)&&h(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(dt){for(let rt=0,pt=Q.length;rt<pt;rt++){const Jt=Q[rt],st=n.get(Jt);e.bindTexture(i.TEXTURE_2D,st.__webglTexture),ct(i.TEXTURE_2D,Jt),St(D.__webglFramebuffer,w,Jt,i.COLOR_ATTACHMENT0+rt,i.TEXTURE_2D,0),g(Jt)&&h(i.TEXTURE_2D)}e.unbindTexture()}else{let rt=i.TEXTURE_2D;if((w.isWebGL3DRenderTarget||w.isWebGLArrayRenderTarget)&&(rt=w.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(rt,K.__webglTexture),ct(rt,M),M.mipmaps&&M.mipmaps.length>0)for(let pt=0;pt<M.mipmaps.length;pt++)St(D.__webglFramebuffer[pt],w,M,i.COLOR_ATTACHMENT0,rt,pt);else St(D.__webglFramebuffer,w,M,i.COLOR_ATTACHMENT0,rt,0);g(M)&&h(rt),e.unbindTexture()}w.depthBuffer&&Ct(w)}function Xt(w){const M=w.textures;for(let D=0,K=M.length;D<K;D++){const Q=M[D];if(g(Q)){const j=S(w),dt=n.get(Q).__webglTexture;e.bindTexture(j,dt),h(j),e.unbindTexture()}}}const ge=[],O=[];function Ue(w){if(w.samples>0){if(Kt(w)===!1){const M=w.textures,D=w.width,K=w.height;let Q=i.COLOR_BUFFER_BIT;const j=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,dt=n.get(w),rt=M.length>1;if(rt)for(let pt=0;pt<M.length;pt++)e.bindFramebuffer(i.FRAMEBUFFER,dt.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+pt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,dt.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+pt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,dt.__webglMultisampledFramebuffer),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,dt.__webglFramebuffer);for(let pt=0;pt<M.length;pt++){if(w.resolveDepthBuffer&&(w.depthBuffer&&(Q|=i.DEPTH_BUFFER_BIT),w.stencilBuffer&&w.resolveStencilBuffer&&(Q|=i.STENCIL_BUFFER_BIT)),rt){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,dt.__webglColorRenderbuffer[pt]);const Jt=n.get(M[pt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Jt,0)}i.blitFramebuffer(0,0,D,K,0,0,D,K,Q,i.NEAREST),c===!0&&(ge.length=0,O.length=0,ge.push(i.COLOR_ATTACHMENT0+pt),w.depthBuffer&&w.resolveDepthBuffer===!1&&(ge.push(j),O.push(j),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,O)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ge))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),rt)for(let pt=0;pt<M.length;pt++){e.bindFramebuffer(i.FRAMEBUFFER,dt.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+pt,i.RENDERBUFFER,dt.__webglColorRenderbuffer[pt]);const Jt=n.get(M[pt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,dt.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+pt,i.TEXTURE_2D,Jt,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,dt.__webglMultisampledFramebuffer)}else if(w.depthBuffer&&w.resolveDepthBuffer===!1&&c){const M=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[M])}}}function Yt(w){return Math.min(s.maxSamples,w.samples)}function Kt(w){const M=n.get(w);return w.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function Ut(w){const M=o.render.frame;u.get(w)!==M&&(u.set(w,M),w.update())}function ce(w,M){const D=w.colorSpace,K=w.format,Q=w.type;return w.isCompressedTexture===!0||w.isVideoTexture===!0||D!==Ji&&D!==zn&&(Qt.getTransfer(D)===oe?(K!==on||Q!==Rn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",D)),M}function Lt(w){return typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement?(l.width=w.naturalWidth||w.width,l.height=w.naturalHeight||w.height):typeof VideoFrame<"u"&&w instanceof VideoFrame?(l.width=w.displayWidth,l.height=w.displayHeight):(l.width=w.width,l.height=w.height),l}this.allocateTextureUnit=L,this.resetTextureUnits=H,this.setTexture2D=$,this.setTexture2DArray=W,this.setTexture3D=Z,this.setTextureCube=N,this.rebindTextures=It,this.setupRenderTarget=te,this.updateRenderTargetMipmap=Xt,this.updateMultisampleRenderTarget=Ue,this.setupDepthRenderbuffer=Ct,this.setupFrameBufferTexture=St,this.useMultisampledRTT=Kt}function m0(i,t){function e(n,s=zn){let r;const o=Qt.getTransfer(s);if(n===Rn)return i.UNSIGNED_BYTE;if(n===Na)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Fa)return i.UNSIGNED_SHORT_5_5_5_1;if(n===vu)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===gu)return i.BYTE;if(n===_u)return i.SHORT;if(n===bs)return i.UNSIGNED_SHORT;if(n===Ua)return i.INT;if(n===oi)return i.UNSIGNED_INT;if(n===gn)return i.FLOAT;if(n===Cs)return i.HALF_FLOAT;if(n===xu)return i.ALPHA;if(n===Mu)return i.RGB;if(n===on)return i.RGBA;if(n===yu)return i.LUMINANCE;if(n===Su)return i.LUMINANCE_ALPHA;if(n===Bi)return i.DEPTH_COMPONENT;if(n===qi)return i.DEPTH_STENCIL;if(n===Oa)return i.RED;if(n===Ba)return i.RED_INTEGER;if(n===wu)return i.RG;if(n===ka)return i.RG_INTEGER;if(n===za)return i.RGBA_INTEGER;if(n===gr||n===_r||n===vr||n===xr)if(o===oe)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===gr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===_r)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===vr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===xr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===gr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===_r)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===vr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===xr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Xo||n===Yo||n===qo||n===Ko)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Xo)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Yo)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===qo)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Ko)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===jo||n===Zo||n===Jo)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===jo||n===Zo)return o===oe?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Jo)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Qo||n===ta||n===ea||n===na||n===ia||n===sa||n===ra||n===oa||n===aa||n===la||n===ca||n===ua||n===ha||n===fa)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Qo)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===ta)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===ea)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===na)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===ia)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===sa)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===ra)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===oa)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===aa)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===la)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===ca)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===ua)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===ha)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===fa)return o===oe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Mr||n===da||n===pa)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Mr)return o===oe?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===da)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===pa)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===bu||n===ma||n===ga||n===_a)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Mr)return r.COMPRESSED_RED_RGTC1_EXT;if(n===ma)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===ga)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===_a)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Yi?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}class g0 extends Ze{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class Dt extends Ae{constructor(){super(),this.isGroup=!0,this.type="Group"}}const _0={type:"move"};class xo{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Dt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Dt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new k,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new k),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Dt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new k,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new k),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,o=null;const a=this._targetRay,c=this._grip,l=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(l&&t.hand){o=!0;for(const _ of t.hand.values()){const g=e.getJointPose(_,n),h=this._getHandJoint(l,_);g!==null&&(h.matrix.fromArray(g.transform.matrix),h.matrix.decompose(h.position,h.rotation,h.scale),h.matrixWorldNeedsUpdate=!0,h.jointRadius=g.radius),h.visible=g!==null}const u=l.joints["index-finger-tip"],f=l.joints["thumb-tip"],d=u.position.distanceTo(f.position),m=.02,p=.005;l.inputState.pinching&&d>m+p?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!l.inputState.pinching&&d<=m-p&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else c!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(c.matrix.fromArray(r.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,r.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(r.linearVelocity)):c.hasLinearVelocity=!1,r.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(r.angularVelocity)):c.hasAngularVelocity=!1));a!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(_0)))}return a!==null&&(a.visible=s!==null),c!==null&&(c.visible=r!==null),l!==null&&(l.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new Dt;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}const v0=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,x0=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class M0{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){const s=new Te,r=t.properties.get(s);r.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new Cn({vertexShader:v0,fragmentShader:x0,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new tt(new ve(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class y0 extends Qi{constructor(t,e){super();const n=this;let s=null,r=1,o=null,a="local-floor",c=1,l=null,u=null,f=null,d=null,m=null,p=null;const _=new M0,g=e.getContextAttributes();let h=null,S=null;const b=[],x=[],P=new Vt;let T=null;const C=new Ze;C.viewport=new le;const R=new Ze;R.viewport=new le;const y=[C,R],v=new g0;let A=null,H=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let nt=b[Y];return nt===void 0&&(nt=new xo,b[Y]=nt),nt.getTargetRaySpace()},this.getControllerGrip=function(Y){let nt=b[Y];return nt===void 0&&(nt=new xo,b[Y]=nt),nt.getGripSpace()},this.getHand=function(Y){let nt=b[Y];return nt===void 0&&(nt=new xo,b[Y]=nt),nt.getHandSpace()};function L(Y){const nt=x.indexOf(Y.inputSource);if(nt===-1)return;const St=b[nt];St!==void 0&&(St.update(Y.inputSource,Y.frame,l||o),St.dispatchEvent({type:Y.type,data:Y.inputSource}))}function z(){s.removeEventListener("select",L),s.removeEventListener("selectstart",L),s.removeEventListener("selectend",L),s.removeEventListener("squeeze",L),s.removeEventListener("squeezestart",L),s.removeEventListener("squeezeend",L),s.removeEventListener("end",z),s.removeEventListener("inputsourceschange",$);for(let Y=0;Y<b.length;Y++){const nt=x[Y];nt!==null&&(x[Y]=null,b[Y].disconnect(nt))}A=null,H=null,_.reset(),t.setRenderTarget(h),m=null,d=null,f=null,s=null,S=null,qt.stop(),n.isPresenting=!1,t.setPixelRatio(T),t.setSize(P.width,P.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){a=Y,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||o},this.setReferenceSpace=function(Y){l=Y},this.getBaseLayer=function(){return d!==null?d:m},this.getBinding=function(){return f},this.getFrame=function(){return p},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(h=t.getRenderTarget(),s.addEventListener("select",L),s.addEventListener("selectstart",L),s.addEventListener("selectend",L),s.addEventListener("squeeze",L),s.addEventListener("squeezestart",L),s.addEventListener("squeezeend",L),s.addEventListener("end",z),s.addEventListener("inputsourceschange",$),g.xrCompatible!==!0&&await e.makeXRCompatible(),T=t.getPixelRatio(),t.getSize(P),s.renderState.layers===void 0){const nt={antialias:g.antialias,alpha:!0,depth:g.depth,stencil:g.stencil,framebufferScaleFactor:r};m=new XRWebGLLayer(s,e,nt),s.updateRenderState({baseLayer:m}),t.setPixelRatio(1),t.setSize(m.framebufferWidth,m.framebufferHeight,!1),S=new ai(m.framebufferWidth,m.framebufferHeight,{format:on,type:Rn,colorSpace:t.outputColorSpace,stencilBuffer:g.stencil})}else{let nt=null,St=null,ft=null;g.depth&&(ft=g.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,nt=g.stencil?qi:Bi,St=g.stencil?Yi:oi);const Pt={colorFormat:e.RGBA8,depthFormat:ft,scaleFactor:r};f=new XRWebGLBinding(s,e),d=f.createProjectionLayer(Pt),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),S=new ai(d.textureWidth,d.textureHeight,{format:on,type:Rn,depthTexture:new ku(d.textureWidth,d.textureHeight,St,void 0,void 0,void 0,void 0,void 0,void 0,nt),stencilBuffer:g.stencil,colorSpace:t.outputColorSpace,samples:g.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(c),l=null,o=await s.requestReferenceSpace(a),qt.setContext(s),qt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function $(Y){for(let nt=0;nt<Y.removed.length;nt++){const St=Y.removed[nt],ft=x.indexOf(St);ft>=0&&(x[ft]=null,b[ft].disconnect(St))}for(let nt=0;nt<Y.added.length;nt++){const St=Y.added[nt];let ft=x.indexOf(St);if(ft===-1){for(let Ct=0;Ct<b.length;Ct++)if(Ct>=x.length){x.push(St),ft=Ct;break}else if(x[Ct]===null){x[Ct]=St,ft=Ct;break}if(ft===-1)break}const Pt=b[ft];Pt&&Pt.connect(St)}}const W=new k,Z=new k;function N(Y,nt,St){W.setFromMatrixPosition(nt.matrixWorld),Z.setFromMatrixPosition(St.matrixWorld);const ft=W.distanceTo(Z),Pt=nt.projectionMatrix.elements,Ct=St.projectionMatrix.elements,It=Pt[14]/(Pt[10]-1),te=Pt[14]/(Pt[10]+1),Xt=(Pt[9]+1)/Pt[5],ge=(Pt[9]-1)/Pt[5],O=(Pt[8]-1)/Pt[0],Ue=(Ct[8]+1)/Ct[0],Yt=It*O,Kt=It*Ue,Ut=ft/(-O+Ue),ce=Ut*-O;if(nt.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(ce),Y.translateZ(Ut),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),Pt[10]===-1)Y.projectionMatrix.copy(nt.projectionMatrix),Y.projectionMatrixInverse.copy(nt.projectionMatrixInverse);else{const Lt=It+Ut,w=te+Ut,M=Yt-ce,D=Kt+(ft-ce),K=Xt*te/w*Lt,Q=ge*te/w*Lt;Y.projectionMatrix.makePerspective(M,D,K,Q,Lt,w),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function at(Y,nt){nt===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(nt.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let nt=Y.near,St=Y.far;_.texture!==null&&(_.depthNear>0&&(nt=_.depthNear),_.depthFar>0&&(St=_.depthFar)),v.near=R.near=C.near=nt,v.far=R.far=C.far=St,(A!==v.near||H!==v.far)&&(s.updateRenderState({depthNear:v.near,depthFar:v.far}),A=v.near,H=v.far),C.layers.mask=Y.layers.mask|2,R.layers.mask=Y.layers.mask|4,v.layers.mask=C.layers.mask|R.layers.mask;const ft=Y.parent,Pt=v.cameras;at(v,ft);for(let Ct=0;Ct<Pt.length;Ct++)at(Pt[Ct],ft);Pt.length===2?N(v,C,R):v.projectionMatrix.copy(C.projectionMatrix),mt(Y,v,ft)};function mt(Y,nt,St){St===null?Y.matrix.copy(nt.matrixWorld):(Y.matrix.copy(St.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(nt.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(nt.projectionMatrix),Y.projectionMatrixInverse.copy(nt.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=xa*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return v},this.getFoveation=function(){if(!(d===null&&m===null))return c},this.setFoveation=function(Y){c=Y,d!==null&&(d.fixedFoveation=Y),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=Y)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(v)};let lt=null;function ct(Y,nt){if(u=nt.getViewerPose(l||o),p=nt,u!==null){const St=u.views;m!==null&&(t.setRenderTargetFramebuffer(S,m.framebuffer),t.setRenderTarget(S));let ft=!1;St.length!==v.cameras.length&&(v.cameras.length=0,ft=!0);for(let Ct=0;Ct<St.length;Ct++){const It=St[Ct];let te=null;if(m!==null)te=m.getViewport(It);else{const ge=f.getViewSubImage(d,It);te=ge.viewport,Ct===0&&(t.setRenderTargetTextures(S,ge.colorTexture,d.ignoreDepthValues?void 0:ge.depthStencilTexture),t.setRenderTarget(S))}let Xt=y[Ct];Xt===void 0&&(Xt=new Ze,Xt.layers.enable(Ct),Xt.viewport=new le,y[Ct]=Xt),Xt.matrix.fromArray(It.transform.matrix),Xt.matrix.decompose(Xt.position,Xt.quaternion,Xt.scale),Xt.projectionMatrix.fromArray(It.projectionMatrix),Xt.projectionMatrixInverse.copy(Xt.projectionMatrix).invert(),Xt.viewport.set(te.x,te.y,te.width,te.height),Ct===0&&(v.matrix.copy(Xt.matrix),v.matrix.decompose(v.position,v.quaternion,v.scale)),ft===!0&&v.cameras.push(Xt)}const Pt=s.enabledFeatures;if(Pt&&Pt.includes("depth-sensing")){const Ct=f.getDepthInformation(St[0]);Ct&&Ct.isValid&&Ct.texture&&_.init(t,Ct,s.renderState)}}for(let St=0;St<b.length;St++){const ft=x[St],Pt=b[St];ft!==null&&Pt!==void 0&&Pt.update(ft,nt,l||o)}lt&&lt(Y,nt),nt.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:nt}),p=null}const qt=new Bu;qt.setAnimationLoop(ct),this.setAnimationLoop=function(Y){lt=Y},this.dispose=function(){}}}const Jn=new an,S0=new re;function w0(i,t){function e(g,h){g.matrixAutoUpdate===!0&&g.updateMatrix(),h.value.copy(g.matrix)}function n(g,h){h.color.getRGB(g.fogColor.value,Uu(i)),h.isFog?(g.fogNear.value=h.near,g.fogFar.value=h.far):h.isFogExp2&&(g.fogDensity.value=h.density)}function s(g,h,S,b,x){h.isMeshBasicMaterial||h.isMeshLambertMaterial?r(g,h):h.isMeshToonMaterial?(r(g,h),f(g,h)):h.isMeshPhongMaterial?(r(g,h),u(g,h)):h.isMeshStandardMaterial?(r(g,h),d(g,h),h.isMeshPhysicalMaterial&&m(g,h,x)):h.isMeshMatcapMaterial?(r(g,h),p(g,h)):h.isMeshDepthMaterial?r(g,h):h.isMeshDistanceMaterial?(r(g,h),_(g,h)):h.isMeshNormalMaterial?r(g,h):h.isLineBasicMaterial?(o(g,h),h.isLineDashedMaterial&&a(g,h)):h.isPointsMaterial?c(g,h,S,b):h.isSpriteMaterial?l(g,h):h.isShadowMaterial?(g.color.value.copy(h.color),g.opacity.value=h.opacity):h.isShaderMaterial&&(h.uniformsNeedUpdate=!1)}function r(g,h){g.opacity.value=h.opacity,h.color&&g.diffuse.value.copy(h.color),h.emissive&&g.emissive.value.copy(h.emissive).multiplyScalar(h.emissiveIntensity),h.map&&(g.map.value=h.map,e(h.map,g.mapTransform)),h.alphaMap&&(g.alphaMap.value=h.alphaMap,e(h.alphaMap,g.alphaMapTransform)),h.bumpMap&&(g.bumpMap.value=h.bumpMap,e(h.bumpMap,g.bumpMapTransform),g.bumpScale.value=h.bumpScale,h.side===Be&&(g.bumpScale.value*=-1)),h.normalMap&&(g.normalMap.value=h.normalMap,e(h.normalMap,g.normalMapTransform),g.normalScale.value.copy(h.normalScale),h.side===Be&&g.normalScale.value.negate()),h.displacementMap&&(g.displacementMap.value=h.displacementMap,e(h.displacementMap,g.displacementMapTransform),g.displacementScale.value=h.displacementScale,g.displacementBias.value=h.displacementBias),h.emissiveMap&&(g.emissiveMap.value=h.emissiveMap,e(h.emissiveMap,g.emissiveMapTransform)),h.specularMap&&(g.specularMap.value=h.specularMap,e(h.specularMap,g.specularMapTransform)),h.alphaTest>0&&(g.alphaTest.value=h.alphaTest);const S=t.get(h),b=S.envMap,x=S.envMapRotation;b&&(g.envMap.value=b,Jn.copy(x),Jn.x*=-1,Jn.y*=-1,Jn.z*=-1,b.isCubeTexture&&b.isRenderTargetTexture===!1&&(Jn.y*=-1,Jn.z*=-1),g.envMapRotation.value.setFromMatrix4(S0.makeRotationFromEuler(Jn)),g.flipEnvMap.value=b.isCubeTexture&&b.isRenderTargetTexture===!1?-1:1,g.reflectivity.value=h.reflectivity,g.ior.value=h.ior,g.refractionRatio.value=h.refractionRatio),h.lightMap&&(g.lightMap.value=h.lightMap,g.lightMapIntensity.value=h.lightMapIntensity,e(h.lightMap,g.lightMapTransform)),h.aoMap&&(g.aoMap.value=h.aoMap,g.aoMapIntensity.value=h.aoMapIntensity,e(h.aoMap,g.aoMapTransform))}function o(g,h){g.diffuse.value.copy(h.color),g.opacity.value=h.opacity,h.map&&(g.map.value=h.map,e(h.map,g.mapTransform))}function a(g,h){g.dashSize.value=h.dashSize,g.totalSize.value=h.dashSize+h.gapSize,g.scale.value=h.scale}function c(g,h,S,b){g.diffuse.value.copy(h.color),g.opacity.value=h.opacity,g.size.value=h.size*S,g.scale.value=b*.5,h.map&&(g.map.value=h.map,e(h.map,g.uvTransform)),h.alphaMap&&(g.alphaMap.value=h.alphaMap,e(h.alphaMap,g.alphaMapTransform)),h.alphaTest>0&&(g.alphaTest.value=h.alphaTest)}function l(g,h){g.diffuse.value.copy(h.color),g.opacity.value=h.opacity,g.rotation.value=h.rotation,h.map&&(g.map.value=h.map,e(h.map,g.mapTransform)),h.alphaMap&&(g.alphaMap.value=h.alphaMap,e(h.alphaMap,g.alphaMapTransform)),h.alphaTest>0&&(g.alphaTest.value=h.alphaTest)}function u(g,h){g.specular.value.copy(h.specular),g.shininess.value=Math.max(h.shininess,1e-4)}function f(g,h){h.gradientMap&&(g.gradientMap.value=h.gradientMap)}function d(g,h){g.metalness.value=h.metalness,h.metalnessMap&&(g.metalnessMap.value=h.metalnessMap,e(h.metalnessMap,g.metalnessMapTransform)),g.roughness.value=h.roughness,h.roughnessMap&&(g.roughnessMap.value=h.roughnessMap,e(h.roughnessMap,g.roughnessMapTransform)),h.envMap&&(g.envMapIntensity.value=h.envMapIntensity)}function m(g,h,S){g.ior.value=h.ior,h.sheen>0&&(g.sheenColor.value.copy(h.sheenColor).multiplyScalar(h.sheen),g.sheenRoughness.value=h.sheenRoughness,h.sheenColorMap&&(g.sheenColorMap.value=h.sheenColorMap,e(h.sheenColorMap,g.sheenColorMapTransform)),h.sheenRoughnessMap&&(g.sheenRoughnessMap.value=h.sheenRoughnessMap,e(h.sheenRoughnessMap,g.sheenRoughnessMapTransform))),h.clearcoat>0&&(g.clearcoat.value=h.clearcoat,g.clearcoatRoughness.value=h.clearcoatRoughness,h.clearcoatMap&&(g.clearcoatMap.value=h.clearcoatMap,e(h.clearcoatMap,g.clearcoatMapTransform)),h.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=h.clearcoatRoughnessMap,e(h.clearcoatRoughnessMap,g.clearcoatRoughnessMapTransform)),h.clearcoatNormalMap&&(g.clearcoatNormalMap.value=h.clearcoatNormalMap,e(h.clearcoatNormalMap,g.clearcoatNormalMapTransform),g.clearcoatNormalScale.value.copy(h.clearcoatNormalScale),h.side===Be&&g.clearcoatNormalScale.value.negate())),h.dispersion>0&&(g.dispersion.value=h.dispersion),h.iridescence>0&&(g.iridescence.value=h.iridescence,g.iridescenceIOR.value=h.iridescenceIOR,g.iridescenceThicknessMinimum.value=h.iridescenceThicknessRange[0],g.iridescenceThicknessMaximum.value=h.iridescenceThicknessRange[1],h.iridescenceMap&&(g.iridescenceMap.value=h.iridescenceMap,e(h.iridescenceMap,g.iridescenceMapTransform)),h.iridescenceThicknessMap&&(g.iridescenceThicknessMap.value=h.iridescenceThicknessMap,e(h.iridescenceThicknessMap,g.iridescenceThicknessMapTransform))),h.transmission>0&&(g.transmission.value=h.transmission,g.transmissionSamplerMap.value=S.texture,g.transmissionSamplerSize.value.set(S.width,S.height),h.transmissionMap&&(g.transmissionMap.value=h.transmissionMap,e(h.transmissionMap,g.transmissionMapTransform)),g.thickness.value=h.thickness,h.thicknessMap&&(g.thicknessMap.value=h.thicknessMap,e(h.thicknessMap,g.thicknessMapTransform)),g.attenuationDistance.value=h.attenuationDistance,g.attenuationColor.value.copy(h.attenuationColor)),h.anisotropy>0&&(g.anisotropyVector.value.set(h.anisotropy*Math.cos(h.anisotropyRotation),h.anisotropy*Math.sin(h.anisotropyRotation)),h.anisotropyMap&&(g.anisotropyMap.value=h.anisotropyMap,e(h.anisotropyMap,g.anisotropyMapTransform))),g.specularIntensity.value=h.specularIntensity,g.specularColor.value.copy(h.specularColor),h.specularColorMap&&(g.specularColorMap.value=h.specularColorMap,e(h.specularColorMap,g.specularColorMapTransform)),h.specularIntensityMap&&(g.specularIntensityMap.value=h.specularIntensityMap,e(h.specularIntensityMap,g.specularIntensityMapTransform))}function p(g,h){h.matcap&&(g.matcap.value=h.matcap)}function _(g,h){const S=t.get(h).light;g.referencePosition.value.setFromMatrixPosition(S.matrixWorld),g.nearDistance.value=S.shadow.camera.near,g.farDistance.value=S.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function b0(i,t,e,n){let s={},r={},o=[];const a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function c(S,b){const x=b.program;n.uniformBlockBinding(S,x)}function l(S,b){let x=s[S.id];x===void 0&&(p(S),x=u(S),s[S.id]=x,S.addEventListener("dispose",g));const P=b.program;n.updateUBOMapping(S,P);const T=t.render.frame;r[S.id]!==T&&(d(S),r[S.id]=T)}function u(S){const b=f();S.__bindingPointIndex=b;const x=i.createBuffer(),P=S.__size,T=S.usage;return i.bindBuffer(i.UNIFORM_BUFFER,x),i.bufferData(i.UNIFORM_BUFFER,P,T),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,b,x),x}function f(){for(let S=0;S<a;S++)if(o.indexOf(S)===-1)return o.push(S),S;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(S){const b=s[S.id],x=S.uniforms,P=S.__cache;i.bindBuffer(i.UNIFORM_BUFFER,b);for(let T=0,C=x.length;T<C;T++){const R=Array.isArray(x[T])?x[T]:[x[T]];for(let y=0,v=R.length;y<v;y++){const A=R[y];if(m(A,T,y,P)===!0){const H=A.__offset,L=Array.isArray(A.value)?A.value:[A.value];let z=0;for(let $=0;$<L.length;$++){const W=L[$],Z=_(W);typeof W=="number"||typeof W=="boolean"?(A.__data[0]=W,i.bufferSubData(i.UNIFORM_BUFFER,H+z,A.__data)):W.isMatrix3?(A.__data[0]=W.elements[0],A.__data[1]=W.elements[1],A.__data[2]=W.elements[2],A.__data[3]=0,A.__data[4]=W.elements[3],A.__data[5]=W.elements[4],A.__data[6]=W.elements[5],A.__data[7]=0,A.__data[8]=W.elements[6],A.__data[9]=W.elements[7],A.__data[10]=W.elements[8],A.__data[11]=0):(W.toArray(A.__data,z),z+=Z.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,H,A.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function m(S,b,x,P){const T=S.value,C=b+"_"+x;if(P[C]===void 0)return typeof T=="number"||typeof T=="boolean"?P[C]=T:P[C]=T.clone(),!0;{const R=P[C];if(typeof T=="number"||typeof T=="boolean"){if(R!==T)return P[C]=T,!0}else if(R.equals(T)===!1)return R.copy(T),!0}return!1}function p(S){const b=S.uniforms;let x=0;const P=16;for(let C=0,R=b.length;C<R;C++){const y=Array.isArray(b[C])?b[C]:[b[C]];for(let v=0,A=y.length;v<A;v++){const H=y[v],L=Array.isArray(H.value)?H.value:[H.value];for(let z=0,$=L.length;z<$;z++){const W=L[z],Z=_(W),N=x%P,at=N%Z.boundary,mt=N+at;x+=at,mt!==0&&P-mt<Z.storage&&(x+=P-mt),H.__data=new Float32Array(Z.storage/Float32Array.BYTES_PER_ELEMENT),H.__offset=x,x+=Z.storage}}}const T=x%P;return T>0&&(x+=P-T),S.__size=x,S.__cache={},this}function _(S){const b={boundary:0,storage:0};return typeof S=="number"||typeof S=="boolean"?(b.boundary=4,b.storage=4):S.isVector2?(b.boundary=8,b.storage=8):S.isVector3||S.isColor?(b.boundary=16,b.storage=12):S.isVector4?(b.boundary=16,b.storage=16):S.isMatrix3?(b.boundary=48,b.storage=48):S.isMatrix4?(b.boundary=64,b.storage=64):S.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",S),b}function g(S){const b=S.target;b.removeEventListener("dispose",g);const x=o.indexOf(b.__bindingPointIndex);o.splice(x,1),i.deleteBuffer(s[b.id]),delete s[b.id],delete r[b.id]}function h(){for(const S in s)i.deleteBuffer(s[S]);o=[],s={},r={}}return{bind:c,update:l,dispose:h}}class Ix{constructor(t={}){const{canvas:e=df(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:f=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let m;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=n.getContextAttributes().alpha}else m=o;const p=new Uint32Array(4),_=new Int32Array(4);let g=null,h=null;const S=[],b=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=xe,this.toneMapping=Gn,this.toneMappingExposure=1;const x=this;let P=!1,T=0,C=0,R=null,y=-1,v=null;const A=new le,H=new le;let L=null;const z=new kt(0);let $=0,W=e.width,Z=e.height,N=1,at=null,mt=null;const lt=new le(0,0,W,Z),ct=new le(0,0,W,Z);let qt=!1;const Y=new Ga;let nt=!1,St=!1;const ft=new re,Pt=new re,Ct=new k,It=new le,te={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Xt=!1;function ge(){return R===null?N:1}let O=n;function Ue(E,F){return e.getContext(E,F)}try{const E={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:u,failIfMajorPerformanceCaveat:f};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${La}`),e.addEventListener("webglcontextlost",J,!1),e.addEventListener("webglcontextrestored",xt,!1),e.addEventListener("webglcontextcreationerror",_t,!1),O===null){const F="webgl2";if(O=Ue(F,E),O===null)throw Ue(F)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(E){throw console.error("THREE.WebGLRenderer: "+E.message),E}let Yt,Kt,Ut,ce,Lt,w,M,D,K,Q,j,dt,rt,pt,Jt,st,Mt,Ft,Ot,yt,Zt,Wt,ue,U;function gt(){Yt=new Im(O),Yt.init(),Wt=new m0(O,Yt),Kt=new wm(O,Yt,t,Wt),Ut=new f0(O,Yt),Kt.reverseDepthBuffer&&d&&Ut.buffers.depth.setReversed(!0),ce=new Dm(O),Lt=new Zg,w=new p0(O,Yt,Ut,Lt,Kt,Wt,ce),M=new Em(x),D=new Cm(x),K=new kf(O),ue=new ym(O,K),Q=new Pm(O,K,ce,ue),j=new Nm(O,Q,K,ce),Ot=new Um(O,Kt,w),st=new bm(Lt),dt=new jg(x,M,D,Yt,Kt,ue,st),rt=new w0(x,Lt),pt=new Qg,Jt=new r0(Yt),Ft=new Mm(x,M,D,Ut,j,m,c),Mt=new u0(x,j,Kt),U=new b0(O,ce,Kt,Ut),yt=new Sm(O,Yt,ce),Zt=new Lm(O,Yt,ce),ce.programs=dt.programs,x.capabilities=Kt,x.extensions=Yt,x.properties=Lt,x.renderLists=pt,x.shadowMap=Mt,x.state=Ut,x.info=ce}gt();const q=new y0(x,O);this.xr=q,this.getContext=function(){return O},this.getContextAttributes=function(){return O.getContextAttributes()},this.forceContextLoss=function(){const E=Yt.get("WEBGL_lose_context");E&&E.loseContext()},this.forceContextRestore=function(){const E=Yt.get("WEBGL_lose_context");E&&E.restoreContext()},this.getPixelRatio=function(){return N},this.setPixelRatio=function(E){E!==void 0&&(N=E,this.setSize(W,Z,!1))},this.getSize=function(E){return E.set(W,Z)},this.setSize=function(E,F,G=!0){if(q.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}W=E,Z=F,e.width=Math.floor(E*N),e.height=Math.floor(F*N),G===!0&&(e.style.width=E+"px",e.style.height=F+"px"),this.setViewport(0,0,E,F)},this.getDrawingBufferSize=function(E){return E.set(W*N,Z*N).floor()},this.setDrawingBufferSize=function(E,F,G){W=E,Z=F,N=G,e.width=Math.floor(E*G),e.height=Math.floor(F*G),this.setViewport(0,0,E,F)},this.getCurrentViewport=function(E){return E.copy(A)},this.getViewport=function(E){return E.copy(lt)},this.setViewport=function(E,F,G,V){E.isVector4?lt.set(E.x,E.y,E.z,E.w):lt.set(E,F,G,V),Ut.viewport(A.copy(lt).multiplyScalar(N).round())},this.getScissor=function(E){return E.copy(ct)},this.setScissor=function(E,F,G,V){E.isVector4?ct.set(E.x,E.y,E.z,E.w):ct.set(E,F,G,V),Ut.scissor(H.copy(ct).multiplyScalar(N).round())},this.getScissorTest=function(){return qt},this.setScissorTest=function(E){Ut.setScissorTest(qt=E)},this.setOpaqueSort=function(E){at=E},this.setTransparentSort=function(E){mt=E},this.getClearColor=function(E){return E.copy(Ft.getClearColor())},this.setClearColor=function(){Ft.setClearColor.apply(Ft,arguments)},this.getClearAlpha=function(){return Ft.getClearAlpha()},this.setClearAlpha=function(){Ft.setClearAlpha.apply(Ft,arguments)},this.clear=function(E=!0,F=!0,G=!0){let V=0;if(E){let B=!1;if(R!==null){const ot=R.texture.format;B=ot===za||ot===ka||ot===Ba}if(B){const ot=R.texture.type,vt=ot===Rn||ot===oi||ot===bs||ot===Yi||ot===Na||ot===Fa,wt=Ft.getClearColor(),bt=Ft.getClearAlpha(),Bt=wt.r,Ht=wt.g,Et=wt.b;vt?(p[0]=Bt,p[1]=Ht,p[2]=Et,p[3]=bt,O.clearBufferuiv(O.COLOR,0,p)):(_[0]=Bt,_[1]=Ht,_[2]=Et,_[3]=bt,O.clearBufferiv(O.COLOR,0,_))}else V|=O.COLOR_BUFFER_BIT}F&&(V|=O.DEPTH_BUFFER_BIT),G&&(V|=O.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),O.clear(V)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",J,!1),e.removeEventListener("webglcontextrestored",xt,!1),e.removeEventListener("webglcontextcreationerror",_t,!1),pt.dispose(),Jt.dispose(),Lt.dispose(),M.dispose(),D.dispose(),j.dispose(),ue.dispose(),U.dispose(),dt.dispose(),q.dispose(),q.removeEventListener("sessionstart",ja),q.removeEventListener("sessionend",Za),Xn.stop()};function J(E){E.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),P=!0}function xt(){console.log("THREE.WebGLRenderer: Context Restored."),P=!1;const E=ce.autoReset,F=Mt.enabled,G=Mt.autoUpdate,V=Mt.needsUpdate,B=Mt.type;gt(),ce.autoReset=E,Mt.enabled=F,Mt.autoUpdate=G,Mt.needsUpdate=V,Mt.type=B}function _t(E){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",E.statusMessage)}function zt(E){const F=E.target;F.removeEventListener("dispose",zt),_e(F)}function _e(E){Re(E),Lt.remove(E)}function Re(E){const F=Lt.get(E).programs;F!==void 0&&(F.forEach(function(G){dt.releaseProgram(G)}),E.isShaderMaterial&&dt.releaseShaderCache(E))}this.renderBufferDirect=function(E,F,G,V,B,ot){F===null&&(F=te);const vt=B.isMesh&&B.matrixWorld.determinant()<0,wt=xh(E,F,G,V,B);Ut.setMaterial(V,vt);let bt=G.index,Bt=1;if(V.wireframe===!0){if(bt=Q.getWireframeAttribute(G),bt===void 0)return;Bt=2}const Ht=G.drawRange,Et=G.attributes.position;let ee=Ht.start*Bt,he=(Ht.start+Ht.count)*Bt;ot!==null&&(ee=Math.max(ee,ot.start*Bt),he=Math.min(he,(ot.start+ot.count)*Bt)),bt!==null?(ee=Math.max(ee,0),he=Math.min(he,bt.count)):Et!=null&&(ee=Math.max(ee,0),he=Math.min(he,Et.count));const de=he-ee;if(de<0||de===1/0)return;ue.setup(B,V,wt,G,bt);let He,ne=yt;if(bt!==null&&(He=K.get(bt),ne=Zt,ne.setIndex(He)),B.isMesh)V.wireframe===!0?(Ut.setLineWidth(V.wireframeLinewidth*ge()),ne.setMode(O.LINES)):ne.setMode(O.TRIANGLES);else if(B.isLine){let At=V.linewidth;At===void 0&&(At=1),Ut.setLineWidth(At*ge()),B.isLineSegments?ne.setMode(O.LINES):B.isLineLoop?ne.setMode(O.LINE_LOOP):ne.setMode(O.LINE_STRIP)}else B.isPoints?ne.setMode(O.POINTS):B.isSprite&&ne.setMode(O.TRIANGLES);if(B.isBatchedMesh)if(B._multiDrawInstances!==null)ne.renderMultiDrawInstances(B._multiDrawStarts,B._multiDrawCounts,B._multiDrawCount,B._multiDrawInstances);else if(Yt.get("WEBGL_multi_draw"))ne.renderMultiDraw(B._multiDrawStarts,B._multiDrawCounts,B._multiDrawCount);else{const At=B._multiDrawStarts,xn=B._multiDrawCounts,ie=B._multiDrawCount,en=bt?K.get(bt).bytesPerElement:1,ui=Lt.get(V).currentProgram.getUniforms();for(let We=0;We<ie;We++)ui.setValue(O,"_gl_DrawID",We),ne.render(At[We]/en,xn[We])}else if(B.isInstancedMesh)ne.renderInstances(ee,de,B.count);else if(G.isInstancedBufferGeometry){const At=G._maxInstanceCount!==void 0?G._maxInstanceCount:1/0,xn=Math.min(G.instanceCount,At);ne.renderInstances(ee,de,xn)}else ne.render(ee,de)};function se(E,F,G){E.transparent===!0&&E.side===Pe&&E.forceSinglePass===!1?(E.side=Be,E.needsUpdate=!0,Ls(E,F,G),E.side=_n,E.needsUpdate=!0,Ls(E,F,G),E.side=Pe):Ls(E,F,G)}this.compile=function(E,F,G=null){G===null&&(G=E),h=Jt.get(G),h.init(F),b.push(h),G.traverseVisible(function(B){B.isLight&&B.layers.test(F.layers)&&(h.pushLight(B),B.castShadow&&h.pushShadow(B))}),E!==G&&E.traverseVisible(function(B){B.isLight&&B.layers.test(F.layers)&&(h.pushLight(B),B.castShadow&&h.pushShadow(B))}),h.setupLights();const V=new Set;return E.traverse(function(B){if(!(B.isMesh||B.isPoints||B.isLine||B.isSprite))return;const ot=B.material;if(ot)if(Array.isArray(ot))for(let vt=0;vt<ot.length;vt++){const wt=ot[vt];se(wt,G,B),V.add(wt)}else se(ot,G,B),V.add(ot)}),b.pop(),h=null,V},this.compileAsync=function(E,F,G=null){const V=this.compile(E,F,G);return new Promise(B=>{function ot(){if(V.forEach(function(vt){Lt.get(vt).currentProgram.isReady()&&V.delete(vt)}),V.size===0){B(E);return}setTimeout(ot,10)}Yt.get("KHR_parallel_shader_compile")!==null?ot():setTimeout(ot,10)})};let tn=null;function vn(E){tn&&tn(E)}function ja(){Xn.stop()}function Za(){Xn.start()}const Xn=new Bu;Xn.setAnimationLoop(vn),typeof self<"u"&&Xn.setContext(self),this.setAnimationLoop=function(E){tn=E,q.setAnimationLoop(E),E===null?Xn.stop():Xn.start()},q.addEventListener("sessionstart",ja),q.addEventListener("sessionend",Za),this.render=function(E,F){if(F!==void 0&&F.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(P===!0)return;if(E.matrixWorldAutoUpdate===!0&&E.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),q.enabled===!0&&q.isPresenting===!0&&(q.cameraAutoUpdate===!0&&q.updateCamera(F),F=q.getCamera()),E.isScene===!0&&E.onBeforeRender(x,E,F,R),h=Jt.get(E,b.length),h.init(F),b.push(h),Pt.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),Y.setFromProjectionMatrix(Pt),St=this.localClippingEnabled,nt=st.init(this.clippingPlanes,St),g=pt.get(E,S.length),g.init(),S.push(g),q.enabled===!0&&q.isPresenting===!0){const ot=x.xr.getDepthSensingMesh();ot!==null&&Gr(ot,F,-1/0,x.sortObjects)}Gr(E,F,0,x.sortObjects),g.finish(),x.sortObjects===!0&&g.sort(at,mt),Xt=q.enabled===!1||q.isPresenting===!1||q.hasDepthSensing()===!1,Xt&&Ft.addToRenderList(g,E),this.info.render.frame++,nt===!0&&st.beginShadows();const G=h.state.shadowsArray;Mt.render(G,E,F),nt===!0&&st.endShadows(),this.info.autoReset===!0&&this.info.reset();const V=g.opaque,B=g.transmissive;if(h.setupLights(),F.isArrayCamera){const ot=F.cameras;if(B.length>0)for(let vt=0,wt=ot.length;vt<wt;vt++){const bt=ot[vt];Qa(V,B,E,bt)}Xt&&Ft.render(E);for(let vt=0,wt=ot.length;vt<wt;vt++){const bt=ot[vt];Ja(g,E,bt,bt.viewport)}}else B.length>0&&Qa(V,B,E,F),Xt&&Ft.render(E),Ja(g,E,F);R!==null&&(w.updateMultisampleRenderTarget(R),w.updateRenderTargetMipmap(R)),E.isScene===!0&&E.onAfterRender(x,E,F),ue.resetDefaultState(),y=-1,v=null,b.pop(),b.length>0?(h=b[b.length-1],nt===!0&&st.setGlobalState(x.clippingPlanes,h.state.camera)):h=null,S.pop(),S.length>0?g=S[S.length-1]:g=null};function Gr(E,F,G,V){if(E.visible===!1)return;if(E.layers.test(F.layers)){if(E.isGroup)G=E.renderOrder;else if(E.isLOD)E.autoUpdate===!0&&E.update(F);else if(E.isLight)h.pushLight(E),E.castShadow&&h.pushShadow(E);else if(E.isSprite){if(!E.frustumCulled||Y.intersectsSprite(E)){V&&It.setFromMatrixPosition(E.matrixWorld).applyMatrix4(Pt);const vt=j.update(E),wt=E.material;wt.visible&&g.push(E,vt,wt,G,It.z,null)}}else if((E.isMesh||E.isLine||E.isPoints)&&(!E.frustumCulled||Y.intersectsObject(E))){const vt=j.update(E),wt=E.material;if(V&&(E.boundingSphere!==void 0?(E.boundingSphere===null&&E.computeBoundingSphere(),It.copy(E.boundingSphere.center)):(vt.boundingSphere===null&&vt.computeBoundingSphere(),It.copy(vt.boundingSphere.center)),It.applyMatrix4(E.matrixWorld).applyMatrix4(Pt)),Array.isArray(wt)){const bt=vt.groups;for(let Bt=0,Ht=bt.length;Bt<Ht;Bt++){const Et=bt[Bt],ee=wt[Et.materialIndex];ee&&ee.visible&&g.push(E,vt,ee,G,It.z,Et)}}else wt.visible&&g.push(E,vt,wt,G,It.z,null)}}const ot=E.children;for(let vt=0,wt=ot.length;vt<wt;vt++)Gr(ot[vt],F,G,V)}function Ja(E,F,G,V){const B=E.opaque,ot=E.transmissive,vt=E.transparent;h.setupLightsView(G),nt===!0&&st.setGlobalState(x.clippingPlanes,G),V&&Ut.viewport(A.copy(V)),B.length>0&&Ps(B,F,G),ot.length>0&&Ps(ot,F,G),vt.length>0&&Ps(vt,F,G),Ut.buffers.depth.setTest(!0),Ut.buffers.depth.setMask(!0),Ut.buffers.color.setMask(!0),Ut.setPolygonOffset(!1)}function Qa(E,F,G,V){if((G.isScene===!0?G.overrideMaterial:null)!==null)return;h.state.transmissionRenderTarget[V.id]===void 0&&(h.state.transmissionRenderTarget[V.id]=new ai(1,1,{generateMipmaps:!0,type:Yt.has("EXT_color_buffer_half_float")||Yt.has("EXT_color_buffer_float")?Cs:Rn,minFilter:si,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Qt.workingColorSpace}));const ot=h.state.transmissionRenderTarget[V.id],vt=V.viewport||A;ot.setSize(vt.z,vt.w);const wt=x.getRenderTarget();x.setRenderTarget(ot),x.getClearColor(z),$=x.getClearAlpha(),$<1&&x.setClearColor(16777215,.5),x.clear(),Xt&&Ft.render(G);const bt=x.toneMapping;x.toneMapping=Gn;const Bt=V.viewport;if(V.viewport!==void 0&&(V.viewport=void 0),h.setupLightsView(V),nt===!0&&st.setGlobalState(x.clippingPlanes,V),Ps(E,G,V),w.updateMultisampleRenderTarget(ot),w.updateRenderTargetMipmap(ot),Yt.has("WEBGL_multisampled_render_to_texture")===!1){let Ht=!1;for(let Et=0,ee=F.length;Et<ee;Et++){const he=F[Et],de=he.object,He=he.geometry,ne=he.material,At=he.group;if(ne.side===Pe&&de.layers.test(V.layers)){const xn=ne.side;ne.side=Be,ne.needsUpdate=!0,tl(de,G,V,He,ne,At),ne.side=xn,ne.needsUpdate=!0,Ht=!0}}Ht===!0&&(w.updateMultisampleRenderTarget(ot),w.updateRenderTargetMipmap(ot))}x.setRenderTarget(wt),x.setClearColor(z,$),Bt!==void 0&&(V.viewport=Bt),x.toneMapping=bt}function Ps(E,F,G){const V=F.isScene===!0?F.overrideMaterial:null;for(let B=0,ot=E.length;B<ot;B++){const vt=E[B],wt=vt.object,bt=vt.geometry,Bt=V===null?vt.material:V,Ht=vt.group;wt.layers.test(G.layers)&&tl(wt,F,G,bt,Bt,Ht)}}function tl(E,F,G,V,B,ot){E.onBeforeRender(x,F,G,V,B,ot),E.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,E.matrixWorld),E.normalMatrix.getNormalMatrix(E.modelViewMatrix),B.onBeforeRender(x,F,G,V,E,ot),B.transparent===!0&&B.side===Pe&&B.forceSinglePass===!1?(B.side=Be,B.needsUpdate=!0,x.renderBufferDirect(G,F,V,B,E,ot),B.side=_n,B.needsUpdate=!0,x.renderBufferDirect(G,F,V,B,E,ot),B.side=Pe):x.renderBufferDirect(G,F,V,B,E,ot),E.onAfterRender(x,F,G,V,B,ot)}function Ls(E,F,G){F.isScene!==!0&&(F=te);const V=Lt.get(E),B=h.state.lights,ot=h.state.shadowsArray,vt=B.state.version,wt=dt.getParameters(E,B.state,ot,F,G),bt=dt.getProgramCacheKey(wt);let Bt=V.programs;V.environment=E.isMeshStandardMaterial?F.environment:null,V.fog=F.fog,V.envMap=(E.isMeshStandardMaterial?D:M).get(E.envMap||V.environment),V.envMapRotation=V.environment!==null&&E.envMap===null?F.environmentRotation:E.envMapRotation,Bt===void 0&&(E.addEventListener("dispose",zt),Bt=new Map,V.programs=Bt);let Ht=Bt.get(bt);if(Ht!==void 0){if(V.currentProgram===Ht&&V.lightsStateVersion===vt)return nl(E,wt),Ht}else wt.uniforms=dt.getUniforms(E),E.onBeforeCompile(wt,x),Ht=dt.acquireProgram(wt,bt),Bt.set(bt,Ht),V.uniforms=wt.uniforms;const Et=V.uniforms;return(!E.isShaderMaterial&&!E.isRawShaderMaterial||E.clipping===!0)&&(Et.clippingPlanes=st.uniform),nl(E,wt),V.needsLights=yh(E),V.lightsStateVersion=vt,V.needsLights&&(Et.ambientLightColor.value=B.state.ambient,Et.lightProbe.value=B.state.probe,Et.directionalLights.value=B.state.directional,Et.directionalLightShadows.value=B.state.directionalShadow,Et.spotLights.value=B.state.spot,Et.spotLightShadows.value=B.state.spotShadow,Et.rectAreaLights.value=B.state.rectArea,Et.ltc_1.value=B.state.rectAreaLTC1,Et.ltc_2.value=B.state.rectAreaLTC2,Et.pointLights.value=B.state.point,Et.pointLightShadows.value=B.state.pointShadow,Et.hemisphereLights.value=B.state.hemi,Et.directionalShadowMap.value=B.state.directionalShadowMap,Et.directionalShadowMatrix.value=B.state.directionalShadowMatrix,Et.spotShadowMap.value=B.state.spotShadowMap,Et.spotLightMatrix.value=B.state.spotLightMatrix,Et.spotLightMap.value=B.state.spotLightMap,Et.pointShadowMap.value=B.state.pointShadowMap,Et.pointShadowMatrix.value=B.state.pointShadowMatrix),V.currentProgram=Ht,V.uniformsList=null,Ht}function el(E){if(E.uniformsList===null){const F=E.currentProgram.getUniforms();E.uniformsList=yr.seqWithValue(F.seq,E.uniforms)}return E.uniformsList}function nl(E,F){const G=Lt.get(E);G.outputColorSpace=F.outputColorSpace,G.batching=F.batching,G.batchingColor=F.batchingColor,G.instancing=F.instancing,G.instancingColor=F.instancingColor,G.instancingMorph=F.instancingMorph,G.skinning=F.skinning,G.morphTargets=F.morphTargets,G.morphNormals=F.morphNormals,G.morphColors=F.morphColors,G.morphTargetsCount=F.morphTargetsCount,G.numClippingPlanes=F.numClippingPlanes,G.numIntersection=F.numClipIntersection,G.vertexAlphas=F.vertexAlphas,G.vertexTangents=F.vertexTangents,G.toneMapping=F.toneMapping}function xh(E,F,G,V,B){F.isScene!==!0&&(F=te),w.resetTextureUnits();const ot=F.fog,vt=V.isMeshStandardMaterial?F.environment:null,wt=R===null?x.outputColorSpace:R.isXRRenderTarget===!0?R.texture.colorSpace:Ji,bt=(V.isMeshStandardMaterial?D:M).get(V.envMap||vt),Bt=V.vertexColors===!0&&!!G.attributes.color&&G.attributes.color.itemSize===4,Ht=!!G.attributes.tangent&&(!!V.normalMap||V.anisotropy>0),Et=!!G.morphAttributes.position,ee=!!G.morphAttributes.normal,he=!!G.morphAttributes.color;let de=Gn;V.toneMapped&&(R===null||R.isXRRenderTarget===!0)&&(de=x.toneMapping);const He=G.morphAttributes.position||G.morphAttributes.normal||G.morphAttributes.color,ne=He!==void 0?He.length:0,At=Lt.get(V),xn=h.state.lights;if(nt===!0&&(St===!0||E!==v)){const qe=E===v&&V.id===y;st.setState(V,E,qe)}let ie=!1;V.version===At.__version?(At.needsLights&&At.lightsStateVersion!==xn.state.version||At.outputColorSpace!==wt||B.isBatchedMesh&&At.batching===!1||!B.isBatchedMesh&&At.batching===!0||B.isBatchedMesh&&At.batchingColor===!0&&B.colorTexture===null||B.isBatchedMesh&&At.batchingColor===!1&&B.colorTexture!==null||B.isInstancedMesh&&At.instancing===!1||!B.isInstancedMesh&&At.instancing===!0||B.isSkinnedMesh&&At.skinning===!1||!B.isSkinnedMesh&&At.skinning===!0||B.isInstancedMesh&&At.instancingColor===!0&&B.instanceColor===null||B.isInstancedMesh&&At.instancingColor===!1&&B.instanceColor!==null||B.isInstancedMesh&&At.instancingMorph===!0&&B.morphTexture===null||B.isInstancedMesh&&At.instancingMorph===!1&&B.morphTexture!==null||At.envMap!==bt||V.fog===!0&&At.fog!==ot||At.numClippingPlanes!==void 0&&(At.numClippingPlanes!==st.numPlanes||At.numIntersection!==st.numIntersection)||At.vertexAlphas!==Bt||At.vertexTangents!==Ht||At.morphTargets!==Et||At.morphNormals!==ee||At.morphColors!==he||At.toneMapping!==de||At.morphTargetsCount!==ne)&&(ie=!0):(ie=!0,At.__version=V.version);let en=At.currentProgram;ie===!0&&(en=Ls(V,F,B));let ui=!1,We=!1,rs=!1;const pe=en.getUniforms(),cn=At.uniforms;if(Ut.useProgram(en.program)&&(ui=!0,We=!0,rs=!0),V.id!==y&&(y=V.id,We=!0),ui||v!==E){Ut.buffers.depth.getReversed()?(ft.copy(E.projectionMatrix),mf(ft),gf(ft),pe.setValue(O,"projectionMatrix",ft)):pe.setValue(O,"projectionMatrix",E.projectionMatrix),pe.setValue(O,"viewMatrix",E.matrixWorldInverse);const Ln=pe.map.cameraPosition;Ln!==void 0&&Ln.setValue(O,Ct.setFromMatrixPosition(E.matrixWorld)),Kt.logarithmicDepthBuffer&&pe.setValue(O,"logDepthBufFC",2/(Math.log(E.far+1)/Math.LN2)),(V.isMeshPhongMaterial||V.isMeshToonMaterial||V.isMeshLambertMaterial||V.isMeshBasicMaterial||V.isMeshStandardMaterial||V.isShaderMaterial)&&pe.setValue(O,"isOrthographic",E.isOrthographicCamera===!0),v!==E&&(v=E,We=!0,rs=!0)}if(B.isSkinnedMesh){pe.setOptional(O,B,"bindMatrix"),pe.setOptional(O,B,"bindMatrixInverse");const qe=B.skeleton;qe&&(qe.boneTexture===null&&qe.computeBoneTexture(),pe.setValue(O,"boneTexture",qe.boneTexture,w))}B.isBatchedMesh&&(pe.setOptional(O,B,"batchingTexture"),pe.setValue(O,"batchingTexture",B._matricesTexture,w),pe.setOptional(O,B,"batchingIdTexture"),pe.setValue(O,"batchingIdTexture",B._indirectTexture,w),pe.setOptional(O,B,"batchingColorTexture"),B._colorsTexture!==null&&pe.setValue(O,"batchingColorTexture",B._colorsTexture,w));const os=G.morphAttributes;if((os.position!==void 0||os.normal!==void 0||os.color!==void 0)&&Ot.update(B,G,en),(We||At.receiveShadow!==B.receiveShadow)&&(At.receiveShadow=B.receiveShadow,pe.setValue(O,"receiveShadow",B.receiveShadow)),V.isMeshGouraudMaterial&&V.envMap!==null&&(cn.envMap.value=bt,cn.flipEnvMap.value=bt.isCubeTexture&&bt.isRenderTargetTexture===!1?-1:1),V.isMeshStandardMaterial&&V.envMap===null&&F.environment!==null&&(cn.envMapIntensity.value=F.environmentIntensity),We&&(pe.setValue(O,"toneMappingExposure",x.toneMappingExposure),At.needsLights&&Mh(cn,rs),ot&&V.fog===!0&&rt.refreshFogUniforms(cn,ot),rt.refreshMaterialUniforms(cn,V,N,Z,h.state.transmissionRenderTarget[E.id]),yr.upload(O,el(At),cn,w)),V.isShaderMaterial&&V.uniformsNeedUpdate===!0&&(yr.upload(O,el(At),cn,w),V.uniformsNeedUpdate=!1),V.isSpriteMaterial&&pe.setValue(O,"center",B.center),pe.setValue(O,"modelViewMatrix",B.modelViewMatrix),pe.setValue(O,"normalMatrix",B.normalMatrix),pe.setValue(O,"modelMatrix",B.matrixWorld),V.isShaderMaterial||V.isRawShaderMaterial){const qe=V.uniformsGroups;for(let Ln=0,Dn=qe.length;Ln<Dn;Ln++){const il=qe[Ln];U.update(il,en),U.bind(il,en)}}return en}function Mh(E,F){E.ambientLightColor.needsUpdate=F,E.lightProbe.needsUpdate=F,E.directionalLights.needsUpdate=F,E.directionalLightShadows.needsUpdate=F,E.pointLights.needsUpdate=F,E.pointLightShadows.needsUpdate=F,E.spotLights.needsUpdate=F,E.spotLightShadows.needsUpdate=F,E.rectAreaLights.needsUpdate=F,E.hemisphereLights.needsUpdate=F}function yh(E){return E.isMeshLambertMaterial||E.isMeshToonMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isShadowMaterial||E.isShaderMaterial&&E.lights===!0}this.getActiveCubeFace=function(){return T},this.getActiveMipmapLevel=function(){return C},this.getRenderTarget=function(){return R},this.setRenderTargetTextures=function(E,F,G){Lt.get(E.texture).__webglTexture=F,Lt.get(E.depthTexture).__webglTexture=G;const V=Lt.get(E);V.__hasExternalTextures=!0,V.__autoAllocateDepthBuffer=G===void 0,V.__autoAllocateDepthBuffer||Yt.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),V.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(E,F){const G=Lt.get(E);G.__webglFramebuffer=F,G.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(E,F=0,G=0){R=E,T=F,C=G;let V=!0,B=null,ot=!1,vt=!1;if(E){const bt=Lt.get(E);if(bt.__useDefaultFramebuffer!==void 0)Ut.bindFramebuffer(O.FRAMEBUFFER,null),V=!1;else if(bt.__webglFramebuffer===void 0)w.setupRenderTarget(E);else if(bt.__hasExternalTextures)w.rebindTextures(E,Lt.get(E.texture).__webglTexture,Lt.get(E.depthTexture).__webglTexture);else if(E.depthBuffer){const Et=E.depthTexture;if(bt.__boundDepthTexture!==Et){if(Et!==null&&Lt.has(Et)&&(E.width!==Et.image.width||E.height!==Et.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");w.setupDepthRenderbuffer(E)}}const Bt=E.texture;(Bt.isData3DTexture||Bt.isDataArrayTexture||Bt.isCompressedArrayTexture)&&(vt=!0);const Ht=Lt.get(E).__webglFramebuffer;E.isWebGLCubeRenderTarget?(Array.isArray(Ht[F])?B=Ht[F][G]:B=Ht[F],ot=!0):E.samples>0&&w.useMultisampledRTT(E)===!1?B=Lt.get(E).__webglMultisampledFramebuffer:Array.isArray(Ht)?B=Ht[G]:B=Ht,A.copy(E.viewport),H.copy(E.scissor),L=E.scissorTest}else A.copy(lt).multiplyScalar(N).floor(),H.copy(ct).multiplyScalar(N).floor(),L=qt;if(Ut.bindFramebuffer(O.FRAMEBUFFER,B)&&V&&Ut.drawBuffers(E,B),Ut.viewport(A),Ut.scissor(H),Ut.setScissorTest(L),ot){const bt=Lt.get(E.texture);O.framebufferTexture2D(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0,O.TEXTURE_CUBE_MAP_POSITIVE_X+F,bt.__webglTexture,G)}else if(vt){const bt=Lt.get(E.texture),Bt=F||0;O.framebufferTextureLayer(O.FRAMEBUFFER,O.COLOR_ATTACHMENT0,bt.__webglTexture,G||0,Bt)}y=-1},this.readRenderTargetPixels=function(E,F,G,V,B,ot,vt){if(!(E&&E.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let wt=Lt.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&vt!==void 0&&(wt=wt[vt]),wt){Ut.bindFramebuffer(O.FRAMEBUFFER,wt);try{const bt=E.texture,Bt=bt.format,Ht=bt.type;if(!Kt.textureFormatReadable(Bt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Kt.textureTypeReadable(Ht)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=E.width-V&&G>=0&&G<=E.height-B&&O.readPixels(F,G,V,B,Wt.convert(Bt),Wt.convert(Ht),ot)}finally{const bt=R!==null?Lt.get(R).__webglFramebuffer:null;Ut.bindFramebuffer(O.FRAMEBUFFER,bt)}}},this.readRenderTargetPixelsAsync=async function(E,F,G,V,B,ot,vt){if(!(E&&E.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let wt=Lt.get(E).__webglFramebuffer;if(E.isWebGLCubeRenderTarget&&vt!==void 0&&(wt=wt[vt]),wt){const bt=E.texture,Bt=bt.format,Ht=bt.type;if(!Kt.textureFormatReadable(Bt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Kt.textureTypeReadable(Ht))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(F>=0&&F<=E.width-V&&G>=0&&G<=E.height-B){Ut.bindFramebuffer(O.FRAMEBUFFER,wt);const Et=O.createBuffer();O.bindBuffer(O.PIXEL_PACK_BUFFER,Et),O.bufferData(O.PIXEL_PACK_BUFFER,ot.byteLength,O.STREAM_READ),O.readPixels(F,G,V,B,Wt.convert(Bt),Wt.convert(Ht),0);const ee=R!==null?Lt.get(R).__webglFramebuffer:null;Ut.bindFramebuffer(O.FRAMEBUFFER,ee);const he=O.fenceSync(O.SYNC_GPU_COMMANDS_COMPLETE,0);return O.flush(),await pf(O,he,4),O.bindBuffer(O.PIXEL_PACK_BUFFER,Et),O.getBufferSubData(O.PIXEL_PACK_BUFFER,0,ot),O.deleteBuffer(Et),O.deleteSync(he),ot}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(E,F=null,G=0){E.isTexture!==!0&&(ys("WebGLRenderer: copyFramebufferToTexture function signature has changed."),F=arguments[0]||null,E=arguments[1]);const V=Math.pow(2,-G),B=Math.floor(E.image.width*V),ot=Math.floor(E.image.height*V),vt=F!==null?F.x:0,wt=F!==null?F.y:0;w.setTexture2D(E,0),O.copyTexSubImage2D(O.TEXTURE_2D,G,0,0,vt,wt,B,ot),Ut.unbindTexture()},this.copyTextureToTexture=function(E,F,G=null,V=null,B=0){E.isTexture!==!0&&(ys("WebGLRenderer: copyTextureToTexture function signature has changed."),V=arguments[0]||null,E=arguments[1],F=arguments[2],B=arguments[3]||0,G=null);let ot,vt,wt,bt,Bt,Ht,Et,ee,he;const de=E.isCompressedTexture?E.mipmaps[B]:E.image;G!==null?(ot=G.max.x-G.min.x,vt=G.max.y-G.min.y,wt=G.isBox3?G.max.z-G.min.z:1,bt=G.min.x,Bt=G.min.y,Ht=G.isBox3?G.min.z:0):(ot=de.width,vt=de.height,wt=de.depth||1,bt=0,Bt=0,Ht=0),V!==null?(Et=V.x,ee=V.y,he=V.z):(Et=0,ee=0,he=0);const He=Wt.convert(F.format),ne=Wt.convert(F.type);let At;F.isData3DTexture?(w.setTexture3D(F,0),At=O.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(w.setTexture2DArray(F,0),At=O.TEXTURE_2D_ARRAY):(w.setTexture2D(F,0),At=O.TEXTURE_2D),O.pixelStorei(O.UNPACK_FLIP_Y_WEBGL,F.flipY),O.pixelStorei(O.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),O.pixelStorei(O.UNPACK_ALIGNMENT,F.unpackAlignment);const xn=O.getParameter(O.UNPACK_ROW_LENGTH),ie=O.getParameter(O.UNPACK_IMAGE_HEIGHT),en=O.getParameter(O.UNPACK_SKIP_PIXELS),ui=O.getParameter(O.UNPACK_SKIP_ROWS),We=O.getParameter(O.UNPACK_SKIP_IMAGES);O.pixelStorei(O.UNPACK_ROW_LENGTH,de.width),O.pixelStorei(O.UNPACK_IMAGE_HEIGHT,de.height),O.pixelStorei(O.UNPACK_SKIP_PIXELS,bt),O.pixelStorei(O.UNPACK_SKIP_ROWS,Bt),O.pixelStorei(O.UNPACK_SKIP_IMAGES,Ht);const rs=E.isDataArrayTexture||E.isData3DTexture,pe=F.isDataArrayTexture||F.isData3DTexture;if(E.isRenderTargetTexture||E.isDepthTexture){const cn=Lt.get(E),os=Lt.get(F),qe=Lt.get(cn.__renderTarget),Ln=Lt.get(os.__renderTarget);Ut.bindFramebuffer(O.READ_FRAMEBUFFER,qe.__webglFramebuffer),Ut.bindFramebuffer(O.DRAW_FRAMEBUFFER,Ln.__webglFramebuffer);for(let Dn=0;Dn<wt;Dn++)rs&&O.framebufferTextureLayer(O.READ_FRAMEBUFFER,O.COLOR_ATTACHMENT0,Lt.get(E).__webglTexture,B,Ht+Dn),E.isDepthTexture?(pe&&O.framebufferTextureLayer(O.DRAW_FRAMEBUFFER,O.COLOR_ATTACHMENT0,Lt.get(F).__webglTexture,B,he+Dn),O.blitFramebuffer(bt,Bt,ot,vt,Et,ee,ot,vt,O.DEPTH_BUFFER_BIT,O.NEAREST)):pe?O.copyTexSubImage3D(At,B,Et,ee,he+Dn,bt,Bt,ot,vt):O.copyTexSubImage2D(At,B,Et,ee,he+Dn,bt,Bt,ot,vt);Ut.bindFramebuffer(O.READ_FRAMEBUFFER,null),Ut.bindFramebuffer(O.DRAW_FRAMEBUFFER,null)}else pe?E.isDataTexture||E.isData3DTexture?O.texSubImage3D(At,B,Et,ee,he,ot,vt,wt,He,ne,de.data):F.isCompressedArrayTexture?O.compressedTexSubImage3D(At,B,Et,ee,he,ot,vt,wt,He,de.data):O.texSubImage3D(At,B,Et,ee,he,ot,vt,wt,He,ne,de):E.isDataTexture?O.texSubImage2D(O.TEXTURE_2D,B,Et,ee,ot,vt,He,ne,de.data):E.isCompressedTexture?O.compressedTexSubImage2D(O.TEXTURE_2D,B,Et,ee,de.width,de.height,He,de.data):O.texSubImage2D(O.TEXTURE_2D,B,Et,ee,ot,vt,He,ne,de);O.pixelStorei(O.UNPACK_ROW_LENGTH,xn),O.pixelStorei(O.UNPACK_IMAGE_HEIGHT,ie),O.pixelStorei(O.UNPACK_SKIP_PIXELS,en),O.pixelStorei(O.UNPACK_SKIP_ROWS,ui),O.pixelStorei(O.UNPACK_SKIP_IMAGES,We),B===0&&F.generateMipmaps&&O.generateMipmap(At),Ut.unbindTexture()},this.copyTextureToTexture3D=function(E,F,G=null,V=null,B=0){return E.isTexture!==!0&&(ys("WebGLRenderer: copyTextureToTexture3D function signature has changed."),G=arguments[0]||null,V=arguments[1]||null,E=arguments[2],F=arguments[3],B=arguments[4]||0),ys('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(E,F,G,V,B)},this.initRenderTarget=function(E){Lt.get(E).__webglFramebuffer===void 0&&w.setupRenderTarget(E)},this.initTexture=function(E){E.isCubeTexture?w.setTextureCube(E,0):E.isData3DTexture?w.setTexture3D(E,0):E.isDataArrayTexture||E.isCompressedArrayTexture?w.setTexture2DArray(E,0):w.setTexture2D(E,0),Ut.unbindTexture()},this.resetState=function(){T=0,C=0,R=null,Ut.reset(),ue.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Tn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=Qt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Qt._getUnpackColorSpace()}}class Wa{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new kt(t),this.near=e,this.far=n}clone(){return new Wa(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class Px extends Ae{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new an,this.environmentIntensity=1,this.environmentRotation=new an,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class E0{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=va,this.updateRanges=[],this.version=0,this.uuid=Vn()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let s=0,r=this.stride;s<r;s++)this.array[t+s]=e.array[n+s];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Vn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Vn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Ne=new k;class wr{constructor(t,e,n,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)Ne.fromBufferAttribute(this,e),Ne.applyMatrix4(t),this.setXYZ(e,Ne.x,Ne.y,Ne.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Ne.fromBufferAttribute(this,e),Ne.applyNormalMatrix(t),this.setXYZ(e,Ne.x,Ne.y,Ne.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Ne.fromBufferAttribute(this,e),Ne.transformDirection(t),this.setXYZ(e,Ne.x,Ne.y,Ne.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=pn(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=ae(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=ae(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=ae(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=ae(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=ae(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=pn(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=pn(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=pn(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=pn(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=ae(e,this.array),n=ae(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=ae(e,this.array),n=ae(n,this.array),s=ae(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=ae(e,this.array),n=ae(n,this.array),s=ae(s,this.array),r=ae(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=s,this.data.array[t+3]=r,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return new Le(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new wr(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const s=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class T0 extends $n{static get type(){return"SpriteMaterial"}constructor(t){super(),this.isSpriteMaterial=!0,this.color=new kt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let Ei;const hs=new k,Ti=new k,Ai=new k,Ri=new Vt,fs=new Vt,Wu=new re,tr=new k,ds=new k,er=new k,ec=new Vt,Mo=new Vt,nc=new Vt;class Lx extends Ae{constructor(t=new T0){if(super(),this.isSprite=!0,this.type="Sprite",Ei===void 0){Ei=new De;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new E0(e,5);Ei.setIndex([0,1,2,0,2,3]),Ei.setAttribute("position",new wr(n,3,0,!1)),Ei.setAttribute("uv",new wr(n,2,3,!1))}this.geometry=Ei,this.material=t,this.center=new Vt(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Ti.setFromMatrixScale(this.matrixWorld),Wu.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),Ai.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Ti.multiplyScalar(-Ai.z);const n=this.material.rotation;let s,r;n!==0&&(r=Math.cos(n),s=Math.sin(n));const o=this.center;nr(tr.set(-.5,-.5,0),Ai,o,Ti,s,r),nr(ds.set(.5,-.5,0),Ai,o,Ti,s,r),nr(er.set(.5,.5,0),Ai,o,Ti,s,r),ec.set(0,0),Mo.set(1,0),nc.set(1,1);let a=t.ray.intersectTriangle(tr,ds,er,!1,hs);if(a===null&&(nr(ds.set(-.5,.5,0),Ai,o,Ti,s,r),Mo.set(0,1),a=t.ray.intersectTriangle(tr,er,ds,!1,hs),a===null))return;const c=t.ray.origin.distanceTo(hs);c<t.near||c>t.far||e.push({distance:c,point:hs.clone(),uv:Je.getInterpolation(hs,tr,ds,er,ec,Mo,nc,new Vt),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function nr(i,t,e,n,s,r){Ri.subVectors(i,e).addScalar(.5).multiply(n),s!==void 0?(fs.x=r*Ri.x-s*Ri.y,fs.y=s*Ri.x+r*Ri.y):fs.copy(Ri),i.copy(t),i.x+=fs.x,i.y+=fs.y,i.applyMatrix4(Wu)}class A0 extends Te{constructor(t=null,e=1,n=1,s,r,o,a,c,l=Nt,u=Nt,f,d){super(null,o,a,c,l,u,s,r,f,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ic extends Le{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Ci=new re,sc=new re,ir=[],rc=new ci,R0=new re,ps=new tt,ms=new ts;class C0 extends tt{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new ic(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,R0)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new ci),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ci),rc.copy(t.boundingBox).applyMatrix4(Ci),this.boundingBox.union(rc)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new ts),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ci),ms.copy(t.boundingSphere).applyMatrix4(Ci),this.boundingSphere.union(ms)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,o=t*r+1;for(let a=0;a<n.length;a++)n[a]=s[o+a]}raycast(t,e){const n=this.matrixWorld,s=this.count;if(ps.geometry=this.geometry,ps.material=this.material,ps.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ms.copy(this.boundingSphere),ms.applyMatrix4(n),t.ray.intersectsSphere(ms)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Ci),sc.multiplyMatrices(n,Ci),ps.matrixWorld=sc,ps.raycast(t,ir);for(let o=0,a=ir.length;o<a;o++){const c=ir[o];c.instanceId=r,c.object=this,e.push(c)}ir.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new ic(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new A0(new Float32Array(s*this.count),s,this.count,Oa,gn));const r=this.morphTexture.source.data.data;let o=0;for(let l=0;l<n.length;l++)o+=n[l];const a=this.geometry.morphTargetsRelative?1:1-o,c=s*t;r[c]=a,r.set(n,c+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class I0 extends $n{static get type(){return"PointsMaterial"}constructor(t){super(),this.isPointsMaterial=!0,this.color=new kt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const oc=new re,ya=new Cu,sr=new ts,rr=new k;class Dx extends Ae{constructor(t=new De,e=new I0){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,s=this.matrixWorld,r=t.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),sr.copy(n.boundingSphere),sr.applyMatrix4(s),sr.radius+=r,t.ray.intersectsSphere(sr)===!1)return;oc.copy(s).invert(),ya.copy(t.ray).applyMatrix4(oc);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),c=a*a,l=n.index,f=n.attributes.position;if(l!==null){const d=Math.max(0,o.start),m=Math.min(l.count,o.start+o.count);for(let p=d,_=m;p<_;p++){const g=l.getX(p);rr.fromBufferAttribute(f,g),ac(rr,g,c,s,t,e,this)}}else{const d=Math.max(0,o.start),m=Math.min(f.count,o.start+o.count);for(let p=d,_=m;p<_;p++)rr.fromBufferAttribute(f,p),ac(rr,p,c,s,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function ac(i,t,e,n,s,r,o){const a=ya.distanceSqToPoint(i);if(a<e){const c=new k;ya.closestPointToPoint(i,c),c.applyMatrix4(n);const l=s.ray.origin.distanceTo(c);if(l<s.near||l>s.far)return;r.push({distance:l,distanceToRay:Math.sqrt(a),point:c,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}class Qe extends Te{constructor(t,e,n,s,r,o,a,c,l){super(t,e,n,s,r,o,a,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Br extends De{constructor(t=1,e=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:s},e=Math.max(3,e);const r=[],o=[],a=[],c=[],l=new k,u=new Vt;o.push(0,0,0),a.push(0,0,1),c.push(.5,.5);for(let f=0,d=3;f<=e;f++,d+=3){const m=n+f/e*s;l.x=t*Math.cos(m),l.y=t*Math.sin(m),o.push(l.x,l.y,l.z),a.push(0,0,1),u.x=(o[d]/t+1)/2,u.y=(o[d+1]/t+1)/2,c.push(u.x,u.y)}for(let f=1;f<=e;f++)r.push(f,f+1,0);this.setIndex(r),this.setAttribute("position",new me(o,3)),this.setAttribute("normal",new me(a,3)),this.setAttribute("uv",new me(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Br(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class ln extends De{constructor(t=1,e=1,n=1,s=32,r=1,o=!1,a=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:c};const l=this;s=Math.floor(s),r=Math.floor(r);const u=[],f=[],d=[],m=[];let p=0;const _=[],g=n/2;let h=0;S(),o===!1&&(t>0&&b(!0),e>0&&b(!1)),this.setIndex(u),this.setAttribute("position",new me(f,3)),this.setAttribute("normal",new me(d,3)),this.setAttribute("uv",new me(m,2));function S(){const x=new k,P=new k;let T=0;const C=(e-t)/n;for(let R=0;R<=r;R++){const y=[],v=R/r,A=v*(e-t)+t;for(let H=0;H<=s;H++){const L=H/s,z=L*c+a,$=Math.sin(z),W=Math.cos(z);P.x=A*$,P.y=-v*n+g,P.z=A*W,f.push(P.x,P.y,P.z),x.set($,C,W).normalize(),d.push(x.x,x.y,x.z),m.push(L,1-v),y.push(p++)}_.push(y)}for(let R=0;R<s;R++)for(let y=0;y<r;y++){const v=_[y][R],A=_[y+1][R],H=_[y+1][R+1],L=_[y][R+1];(t>0||y!==0)&&(u.push(v,A,L),T+=3),(e>0||y!==r-1)&&(u.push(A,H,L),T+=3)}l.addGroup(h,T,0),h+=T}function b(x){const P=p,T=new Vt,C=new k;let R=0;const y=x===!0?t:e,v=x===!0?1:-1;for(let H=1;H<=s;H++)f.push(0,g*v,0),d.push(0,v,0),m.push(.5,.5),p++;const A=p;for(let H=0;H<=s;H++){const z=H/s*c+a,$=Math.cos(z),W=Math.sin(z);C.x=y*W,C.y=g*v,C.z=y*$,f.push(C.x,C.y,C.z),d.push(0,v,0),T.x=$*.5+.5,T.y=W*.5*v+.5,m.push(T.x,T.y),p++}for(let H=0;H<s;H++){const L=P+H,z=A+H;x===!0?u.push(z,z+1,L):u.push(z+1,z,L),R+=3}l.addGroup(h,R,x===!0?1:2),h+=R}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ln(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Ts extends ln{constructor(t=1,e=1,n=32,s=1,r=!1,o=0,a=Math.PI*2){super(0,t,e,n,s,r,o,a),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:o,thetaLength:a}}static fromJSON(t){return new Ts(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class is extends De{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const c=Math.min(o+a,Math.PI);let l=0;const u=[],f=new k,d=new k,m=[],p=[],_=[],g=[];for(let h=0;h<=n;h++){const S=[],b=h/n;let x=0;h===0&&o===0?x=.5/e:h===n&&c===Math.PI&&(x=-.5/e);for(let P=0;P<=e;P++){const T=P/e;f.x=-t*Math.cos(s+T*r)*Math.sin(o+b*a),f.y=t*Math.cos(o+b*a),f.z=t*Math.sin(s+T*r)*Math.sin(o+b*a),p.push(f.x,f.y,f.z),d.copy(f).normalize(),_.push(d.x,d.y,d.z),g.push(T+x,1-b),S.push(l++)}u.push(S)}for(let h=0;h<n;h++)for(let S=0;S<e;S++){const b=u[h][S+1],x=u[h][S],P=u[h+1][S],T=u[h+1][S+1];(h!==0||o>0)&&m.push(b,x,T),(h!==n-1||c<Math.PI)&&m.push(x,P,T)}this.setIndex(m),this.setAttribute("position",new me(p,3)),this.setAttribute("normal",new me(_,3)),this.setAttribute("uv",new me(g,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new is(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class Ux extends $n{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new kt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new kt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ha,this.normalScale=new Vt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new an,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Tt extends $n{static get type(){return"MeshLambertMaterial"}constructor(t){super(),this.isMeshLambertMaterial=!0,this.color=new kt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new kt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ha,this.normalScale=new Vt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new an,this.combine=Da,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}const lc={enabled:!1,files:{},add:function(i,t){this.enabled!==!1&&(this.files[i]=t)},get:function(i){if(this.enabled!==!1)return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};class P0{constructor(t,e,n){const s=this;let r=!1,o=0,a=0,c;const l=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this.itemStart=function(u){a++,r===!1&&s.onStart!==void 0&&s.onStart(u,o,a),r=!0},this.itemEnd=function(u){o++,s.onProgress!==void 0&&s.onProgress(u,o,a),o===a&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(u){s.onError!==void 0&&s.onError(u)},this.resolveURL=function(u){return c?c(u):u},this.setURLModifier=function(u){return c=u,this},this.addHandler=function(u,f){return l.push(u,f),this},this.removeHandler=function(u){const f=l.indexOf(u);return f!==-1&&l.splice(f,2),this},this.getHandler=function(u){for(let f=0,d=l.length;f<d;f+=2){const m=l[f],p=l[f+1];if(m.global&&(m.lastIndex=0),m.test(u))return p}return null}}}const L0=new P0;class $a{constructor(t){this.manager=t!==void 0?t:L0,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(t,e){const n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}}$a.DEFAULT_MATERIAL_NAME="__DEFAULT";class D0 extends $a{constructor(t){super(t)}load(t,e,n,s){this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const r=this,o=lc.get(t);if(o!==void 0)return r.manager.itemStart(t),setTimeout(function(){e&&e(o),r.manager.itemEnd(t)},0),o;const a=Es("img");function c(){u(),lc.add(t,this),e&&e(this),r.manager.itemEnd(t)}function l(f){u(),s&&s(f),r.manager.itemError(t),r.manager.itemEnd(t)}function u(){a.removeEventListener("load",c,!1),a.removeEventListener("error",l,!1)}return a.addEventListener("load",c,!1),a.addEventListener("error",l,!1),t.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),r.manager.itemStart(t),a.src=t,a}}class kr extends $a{constructor(t){super(t)}load(t,e,n,s){const r=new Te,o=new D0(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(t,function(a){r.image=a,r.needsUpdate=!0,e!==void 0&&e(r)},n,s),r}}class $u extends Ae{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new kt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}const yo=new re,cc=new k,uc=new k;class U0{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Vt(512,512),this.map=null,this.mapPass=null,this.matrix=new re,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ga,this._frameExtents=new Vt(1,1),this._viewportCount=1,this._viewports=[new le(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;cc.setFromMatrixPosition(t.matrixWorld),e.position.copy(cc),uc.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(uc),e.updateMatrixWorld(),yo.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(yo),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(yo)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}const hc=new re,gs=new k,So=new k;class N0 extends U0{constructor(){super(new Ze(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new Vt(4,2),this._viewportCount=6,this._viewports=[new le(2,1,1,1),new le(0,1,1,1),new le(3,1,1,1),new le(1,1,1,1),new le(3,0,1,1),new le(1,0,1,1)],this._cubeDirections=[new k(1,0,0),new k(-1,0,0),new k(0,0,1),new k(0,0,-1),new k(0,1,0),new k(0,-1,0)],this._cubeUps=[new k(0,1,0),new k(0,1,0),new k(0,1,0),new k(0,1,0),new k(0,0,1),new k(0,0,-1)]}updateMatrices(t,e=0){const n=this.camera,s=this.matrix,r=t.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),gs.setFromMatrixPosition(t.matrixWorld),n.position.copy(gs),So.copy(n.position),So.add(this._cubeDirections[e]),n.up.copy(this._cubeUps[e]),n.lookAt(So),n.updateMatrixWorld(),s.makeTranslation(-gs.x,-gs.y,-gs.z),hc.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(hc)}}class Xu extends $u{constructor(t,e,n=0,s=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new N0}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}}class Nx extends $u{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:La}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=La);function F0(i,t="/crawl/"){if(typeof i!="string"||i.length===0||/^(https?:|data:|blob:)/i.test(i)||!i.startsWith("/")||i.startsWith("/api/")||!t||t==="/")return i;const e=t.endsWith("/")?t.slice(0,-1):t;return i===e||i.startsWith(`${e}/`)?i:`${e}${i}`}function fc(i){return F0(i)}let dc=!1;function Fx(){if(dc||typeof window>"u")return;dc=!0;const i=window.fetch.bind(window);window.fetch=((e,n)=>i(typeof e=="string"?fc(e):e,n));const t=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");if(t!=null&&t.set){const e=t.set;Object.defineProperty(HTMLImageElement.prototype,"src",{configurable:!0,enumerable:t.enumerable??!0,get:t.get,set(n){e.call(this,typeof n=="string"?fc(n):n)}})}}const ji=640,In=360,Ve=8,Ox={x:Ve,y:Ve,w:48,h:48},Bx={w:128,h:128,get x(){return ji-Ve-this.w},y:Ve,cellSize:6},br={x:Ve,w:140,h:24,get y(){return In-Ve-this.h}},pc={w:100,h:24,get x(){return br.x+br.w+Ve},get y(){return In-Ve-this.h}},mc={w:80,h:24,get x(){return pc.x+pc.w+Ve},get y(){return In-Ve-this.h}},kx={w:120,h:24,get x(){return mc.x+mc.w+Ve},get y(){return In-Ve-this.h}},zx={w:144,h:176,get x(){return ji-Ve-this.w},get y(){return In-Ve-this.h}},Hx={get x(){return br.x},get y(){return br.y-20},iconSize:14,gap:4},Gx={w:460,h:310,get x(){return Math.floor((ji-this.w)/2)},get y(){return Math.floor((In-this.h)/2)}},O0=2;function Xa(){if(typeof window>"u")return 1;const i=window.devicePixelRatio;return i>0&&Number.isFinite(i)?i:1}function Vx(i=Xa()){const t=i>0&&Number.isFinite(i)?i:1;return Math.min(t,O0)}function B0(i,t,e,n,s=Xa()){const r=Math.max(1,Math.round(e)),o=Math.max(1,Math.round(n)),a=s>0&&Number.isFinite(s)?s:1,c=r/ji,l=o/In,u=Math.max(1,Math.round(r*a)),f=Math.max(1,Math.round(o*a));return i.style.width=`${r}px`,i.style.height=`${o}px`,i.style.imageRendering="auto",i.width!==u&&(i.width=u),i.height!==f&&(i.height=f),t.setTransform(c*a,0,0,l*a,0,0),t.imageSmoothingEnabled=!1,{cssW:r,cssH:o,dpr:a,scaleX:c,scaleY:l}}function Wx(i){const t=i.getContext("2d");if(!t)return{cssW:ji,cssH:In,dpr:1,scaleX:1,scaleY:1};const e=typeof window<"u"?window.innerWidth:ji,n=typeof window<"u"?window.innerHeight:In;return B0(i,t,e,n,Xa())}function $x(i,t,e,n,s){const r=()=>{s!==void 0?i.fillText(t,e,n,s):i.fillText(t,e,n)};if(typeof i.getTransform!="function"||typeof i.save!="function"){r();return}const o=i.getTransform();if(!o||o.a===0||o.d===0){r();return}const a=o.a*e+o.c*n+o.e,c=o.b*e+o.d*n+o.f,l=Math.round(a),u=Math.round(c);if(l===a&&u===c){r();return}i.save(),i.setTransform(o.a,o.b,o.c,o.d,l-(o.a*e+o.c*n),u-(o.b*e+o.d*n)),r(),i.restore()}function Xx(){const i=typeof document<"u"?document.fonts:void 0;return i!=null&&i.ready?i.ready.then(()=>{}):Promise.resolve()}const gc={N:0,E:-Math.PI/2,S:Math.PI,W:Math.PI/2},Oe={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]},Sa={N:"W",W:"S",S:"E",E:"N"},wa={N:"E",E:"S",S:"W",W:"N"},Wn=new Set(["."]);function zr(i){if(!i||i.length===0)return Wn;const t=new Set(Wn);for(const e of i)e.solid||t.add(e.char);return t}function k0(i,t,e,n=Wn,s,r){if(e<0||e>=i.length||t<0||t>=i[0].length)return!1;const o=i[e][t];return!(!n.has(o)||s&&!s(t,e)||r&&r(t,e))}class z0{constructor(t,e,n,s,r,o,a,c){it(this,"col");it(this,"row");it(this,"facing");it(this,"walkable");it(this,"isDoorOpen");it(this,"isBlocked");it(this,"isEdgeBlocked");it(this,"isRampAccessible");this.col=t,this.row=e,this.facing=n,this.walkable=s??Wn,this.isDoorOpen=r,this.isBlocked=o,this.isEdgeBlocked=a,this.isRampAccessible=c}setWalkable(t){this.walkable=t}canMoveTo(t,e,n){var r,o;const s=k0(t,e,n,this.walkable,this.isDoorOpen,this.isBlocked);return!(!s&&!((r=this.isRampAccessible)!=null&&r.call(this,this.col,this.row,e,n))||s&&((o=this.isEdgeBlocked)!=null&&o.call(this,this.col,this.row,e,n)))}moveForward(t){const[e,n]=Oe[this.facing],s=this.col+e,r=this.row+n;return this.canMoveTo(t,s,r)?(this.col=s,this.row=r,!0):!1}moveBack(t){const[e,n]=Oe[this.facing],s=this.col-e,r=this.row-n;return this.canMoveTo(t,s,r)?(this.col=s,this.row=r,!0):!1}strafeLeft(t){const[e,n]=Oe[Sa[this.facing]],s=this.col+e,r=this.row+n;return this.canMoveTo(t,s,r)?(this.col=s,this.row=r,!0):!1}strafeRight(t){const[e,n]=Oe[wa[this.facing]],s=this.col+e,r=this.row+n;return this.canMoveTo(t,s,r)?(this.col=s,this.row=r,!0):!1}turnLeft(){this.facing=Sa[this.facing]}turnRight(){this.facing=wa[this.facing]}}function Yx(i){const[t,e]=Oe[i.facing];return{col:i.col+t,row:i.row+e}}function Yu(i,t){if(i==="#")return!0;if(!i||!t)return!1;const e=t.get(i);return e!==void 0&&e.solid===!0&&!e.seeThrough}function Er(i){const t=new Map;if(i)for(const e of i)t.set(e.char,e);return t}function Ni(i,t,e,n,s=!1){return!i||e<0||e>=i.length||t<0||t>=i[0].length?s:Yu(i[e][t],n)}function H0(i,t,e,n,s){if(!t)return i;let r=i;for(const o of t)if(e>=o.fromCol&&e<=o.toCol&&n>=o.fromRow&&n<=o.toRow){const a=o[s];a!==void 0&&(r=a)}return r}function As(i,t,e,n,s,r){let o=!1;return i&&e>=0&&e<i.length&&t>=0&&t<i[0].length&&(o=!Yu(i[e][t],n)),H0(o,s,t,e,r)}function qx(i){if(i.layerIndex<=0)return!1;let t=As(i.belowGrid,i.col,i.row,i.charDefMap,i.areas,"openBottom");return i.pitOpen&&(t=!0),t&&i.entitySupported?!1:t}const et=64;function ke(i){const t=new Qe(i);return t.magFilter=Nt,t.minFilter=Nt,t.colorSpace=xe,t}function ut(i,t){return Math.max(0,Math.min(255,i+Math.floor(Math.random()*t*2-t)))}function ze(){const i=document.createElement("canvas");return i.width=et,i.height=et,[i,i.getContext("2d")]}function G0(){const[i,t]=ze();for(let n=0;n<et;n++)for(let s=0;s<et;s++){const r=ut(140,14),o=ut(120,12),a=ut(100,12);t.fillStyle=`rgb(${r},${o},${a})`,t.fillRect(s,n,1,1)}const e=[0,16,32,48];t.fillStyle="rgba(40, 34, 28, 0.6)";for(const n of e)t.fillRect(0,n,et,1);for(let n=0;n<e.length;n++){const s=n%2===0?0:16;for(let r=s;r<et;r+=32){const o=e[n],a=n<e.length-1?e[n+1]:et;t.fillRect(r,o,1,a-o)}}return ke(i)}function V0(){const[i,t]=ze();for(let n=0;n<et;n++)for(let s=0;s<et;s++){const r=ut(160,16),o=ut(90,10),a=ut(60,8);t.fillStyle=`rgb(${r},${o},${a})`,t.fillRect(s,n,1,1)}const e=[0,12,24,36,48,60];t.fillStyle="rgba(60, 50, 40, 0.7)";for(const n of e)t.fillRect(0,n,et,2);for(let n=0;n<e.length;n++){const s=n%2===0?0:16;for(let r=s;r<et;r+=32){const o=e[n],a=n<e.length-1?e[n+1]:et;t.fillRect(r,o,2,a-o)}}return ke(i)}function W0(){const[i,t]=ze();for(let n=0;n<et;n++)for(let s=0;s<et;s++){const r=ut(140,14),o=ut(120,12),a=ut(100,12);t.fillStyle=`rgb(${r},${o},${a})`,t.fillRect(s,n,1,1)}const e=[0,16,32,48];t.fillStyle="rgba(40, 34, 28, 0.6)";for(const n of e)t.fillRect(0,n,et,1);for(let n=0;n<e.length;n++){const s=n%2===0?0:16;for(let r=s;r<et;r+=32){const o=e[n],a=n<e.length-1?e[n+1]:et;t.fillRect(r,o,1,a-o)}}for(let n=0;n<80;n++){const s=Math.floor(Math.random()*et),r=32+Math.floor(Math.random()*32),o=ut(50,15),a=ut(100,20),c=ut(40,10);t.fillStyle=`rgba(${o},${a},${c},0.7)`;const l=1+Math.floor(Math.random()*3);t.fillRect(s,r,l,l)}return ke(i)}function $0(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(120,10),r=ut(80,8),o=ut(45,6);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}t.strokeStyle="rgba(80, 55, 30, 0.4)",t.lineWidth=1;for(let e=0;e<et;e+=4+Math.floor(Math.random()*4))t.beginPath(),t.moveTo(e,0),t.lineTo(e+ut(0,2),et),t.stroke();for(let e=0;e<3;e++){const n=8+Math.floor(Math.random()*(et-16)),s=8+Math.floor(Math.random()*(et-16));t.fillStyle="rgba(60, 40, 20, 0.6)",t.beginPath(),t.ellipse(n,s,3,4,0,0,Math.PI*2),t.fill()}return ke(i)}function X0(){const[i,t]=ze();for(let n=0;n<et;n++)for(let s=0;s<et;s++){const r=ut(40,12),o=ut(65,18),a=ut(30,10);t.fillStyle=`rgb(${r},${o},${a})`,t.fillRect(s,n,1,1)}const e=[6,22,40,55];for(const n of e){const s=6+Math.floor(Math.random()*3);for(let r=0;r<et;r++)for(let o=0;o<s;o++){const a=ut(35,8),c=ut(22,6),l=ut(12,4);t.fillStyle=`rgb(${a},${c},${l})`,t.fillRect(n+o,r,1,1)}}t.fillStyle="rgba(10, 20, 8, 0.35)",t.fillRect(0,42,et,et-42),t.fillStyle="rgba(70, 110, 40, 0.15)",t.fillRect(0,0,et,20);for(let n=0;n<40;n++){const s=Math.floor(Math.random()*et),r=Math.floor(Math.random()*et),o=Math.random()>.5,a=o?ut(50,12):ut(20,8),c=o?ut(110,20):ut(55,12),l=o?ut(30,10):ut(15,6);t.fillStyle=`rgba(${a},${c},${l},0.75)`;const u=2+Math.floor(Math.random()*4);t.fillRect(s,r,u,u)}return ke(i)}function Y0(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(70,10),r=ut(62,8),o=ut(54,8);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}return t.fillStyle="rgba(28, 22, 16, 0.7)",t.fillRect(0,0,et,1),t.fillRect(0,32,et,1),t.fillRect(0,0,1,et),t.fillRect(32,0,1,et),ke(i)}function q0(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(95,18),r=ut(70,14),o=ut(40,10);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}for(let e=0;e<20;e++){const n=Math.floor(Math.random()*et),s=Math.floor(Math.random()*et),r=Math.random()>.5,o=r?ut(120,10):ut(60,8),a=r?ut(95,8):ut(45,6),c=r?ut(60,6):ut(25,4);t.fillStyle=`rgb(${o},${a},${c})`,t.fillRect(n,s,2,2)}return ke(i)}function K0(){const[i,t]=ze();for(let n=0;n<et;n++)for(let s=0;s<et;s++){const r=ut(90,12),o=ut(82,10),a=ut(74,10);t.fillStyle=`rgb(${r},${o},${a})`,t.fillRect(s,n,1,1)}t.strokeStyle="rgba(30, 25, 20, 0.6)",t.lineWidth=1;const e=[[4,4,10,8],[20,2,12,10],[38,4,10,9],[52,3,10,8],[2,16,11,9],[16,15,13,10],[34,16,10,8],[48,14,12,10],[6,28,10,9],[22,27,11,10],[38,28,12,8],[54,26,8,10],[1,40,12,9],[18,39,10,10],[32,40,13,9],[50,38,11,10],[4,52,11,10],[20,50,12,11],[36,52,10,9],[50,51,12,10]];for(const[n,s,r,o]of e)t.beginPath(),t.ellipse(n+r/2,s+o/2,r/2,o/2,0,0,Math.PI*2),t.stroke();return ke(i)}function j0(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(55,14),r=ut(100,20),o=ut(35,10);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}for(let e=0;e<50;e++){const n=Math.floor(Math.random()*et),s=Math.floor(Math.random()*et),r=ut(30,8),o=ut(70,12),a=ut(20,6);t.fillStyle=`rgba(${r},${o},${a},0.8)`;const c=2+Math.floor(Math.random()*2);t.fillRect(n,s,c,c)}for(let e=0;e<8;e++){const n=Math.floor(Math.random()*et),s=Math.floor(Math.random()*et),r=ut(130,16),o=ut(105,14),a=ut(45,10);t.fillStyle=`rgba(${r},${o},${a},0.5)`;const c=3+Math.floor(Math.random()*4),l=2+Math.floor(Math.random()*3);t.fillRect(n,s,c,l)}return ke(i)}function Z0(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(48,8),r=ut(42,6),o=ut(36,6);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}return t.strokeStyle="rgba(16, 12, 8, 0.5)",t.lineWidth=1,t.beginPath(),t.moveTo(8,0),t.lineTo(24,28),t.lineTo(56,36),t.stroke(),t.beginPath(),t.moveTo(40,4),t.lineTo(36,52),t.lineTo(60,60),t.stroke(),ke(i)}function J0(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(55,8),r=ut(38,6),o=ut(22,5);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}return t.fillStyle="rgba(40, 28, 16, 0.8)",t.fillRect(0,10,et,6),t.fillRect(0,48,et,6),t.fillStyle="rgba(80, 60, 35, 0.4)",t.fillRect(0,10,et,1),t.fillRect(0,48,et,1),ke(i)}function Q0(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(25,8),r=ut(55,14),o=ut(18,6);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}for(let e=0;e<25;e++){const n=Math.floor(Math.random()*et),s=Math.floor(Math.random()*et),r=ut(40,10),o=ut(80,16),a=ut(28,8);t.fillStyle=`rgba(${r},${o},${a},0.6)`;const c=4+Math.floor(Math.random()*8),l=3+Math.floor(Math.random()*6);t.fillRect(n,s,c,l)}for(let e=0;e<5;e++){const n=Math.floor(Math.random()*et),s=Math.floor(Math.random()*et);t.fillStyle="rgba(80, 120, 50, 0.7)";const r=1+Math.floor(Math.random()*3);t.beginPath(),t.arc(n,s,r,0,Math.PI*2),t.fill()}return ke(i)}const t_={stone:G0,brick:V0,mossy:W0,wood:$0,forest:X0},e_={stone_tile:Y0,dirt:q0,cobblestone:K0,grass:j0},n_={dark_rock:Z0,wooden_beams:J0,canopy:Q0},_c=new Map,vc=new Map,xc=new Map;function Hr(i="stone"){let t=_c.get(i);return t||(t=t_[i](),_c.set(i,t)),t}function Is(i="stone_tile"){let t=vc.get(i);return t||(t=e_[i](),vc.set(i,t)),t}function Ya(i="dark_rock"){let t=xc.get(i);return t||(t=n_[i](),xc.set(i,t)),t}const Kx=["stone_thin","iron_fence","wood_fence","railing"],ba=128;function i_(){const i=document.createElement("canvas");return i.width=ba,i.height=ba,[i,i.getContext("2d")]}function s_(i){const[t,e]=i_(),n=ba;if(i==="stone_thin"){for(let o=0;o<n;o++)for(let a=0;a<n;a++){const c=ut(112,12),l=ut(112,10),u=ut(112,10);e.fillStyle=`rgb(${c},${l},${u})`,e.fillRect(a,o,1,1)}for(let o=0;o<12;o++){const a=Math.floor(Math.random()*n),c=Math.floor(Math.random()*n),l=ut(150,10);e.fillStyle=`rgba(${l},${l},${l},0.3)`,e.fillRect(a,c,8+Math.floor(Math.random()*10),6+Math.floor(Math.random()*6))}const r=[0,26,52,78,104];e.fillStyle="rgba(80, 80, 80, 0.75)";for(const o of r)e.fillRect(0,o,n,2);for(let o=0;o<r.length;o++){const a=o%2===0?0:32,c=r[o],l=o<r.length-1?r[o+1]:n;for(let u=a;u<n;u+=64)e.fillRect(u,c,2,l-c)}}else if(i==="iron_fence"){e.clearRect(0,0,n,n);const r=[20,46,72,98],o=8;for(const c of r)e.fillStyle="#555555",e.fillRect(c,0,o,n),e.fillStyle="#666666",e.fillRect(c,0,2,n),e.fillStyle="#3a3a3a",e.fillRect(c+o-2,0,2,n);const a=[32,96];for(const c of a)e.fillStyle="#4a4a4a",e.fillRect(0,c,n,8),e.fillStyle="#5a5a5a",e.fillRect(0,c,n,2)}else if(i==="wood_fence"){e.clearRect(0,0,n,n);const r=[4,34,64,94],o=26;for(const a of r){for(let c=0;c<n;c++)for(let l=a;l<a+o;l++){const u=ut(107,10),f=ut(68,8),d=ut(35,6);e.fillStyle=`rgb(${u},${f},${d})`,e.fillRect(l,c,1,1)}e.fillStyle="rgba(80, 50, 24, 0.25)";for(let c=6;c<n;c+=8+Math.floor(Math.random()*4))e.fillRect(a,c,o,1);e.fillStyle="#503318",e.fillRect(a,0,2,n),e.fillRect(a+o-2,0,2,n)}}else if(i==="railing"){e.clearRect(0,0,n,n);const r=[28,90],o=10;for(const c of r)e.fillStyle="#505050",e.fillRect(0,c,n,o),e.fillStyle="#666666",e.fillRect(0,c,n,2),e.fillStyle="#383838",e.fillRect(0,c+o-2,n,2);const a=[16,48,80,112];for(const c of a)e.fillStyle="#484848",e.fillRect(c,0,4,n)}else e.fillStyle="#888888",e.fillRect(0,0,n,n);const s=new Qe(t);return s.magFilter=Nt,s.minFilter=Nt,s.colorSpace=xe,s}const Mc=new Map;function yc(i){const t=Mc.get(i);if(t)return t;const e=s_(i);return Mc.set(i,e),e}function r_(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(100,10),r=ut(65,8),o=ut(35,6);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}return t.fillStyle="rgba(40, 25, 12, 0.7)",t.fillRect(0,0,2,et),t.fillRect(et-2,0,2,et),t.fillRect(21,0,1,et),t.fillRect(42,0,1,et),t.fillRect(0,0,et,2),t.fillRect(0,et-2,et,2),t.fillRect(0,20,et,2),t.fillRect(0,42,et,2),ke(i)}function o_(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(70,8),r=ut(45,6),o=ut(25,5);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}t.fillStyle="rgba(30, 18, 8, 0.8)",t.fillRect(0,0,2,et),t.fillRect(et-2,0,2,et),t.fillRect(21,0,1,et),t.fillRect(42,0,1,et),t.fillRect(0,0,et,2),t.fillRect(0,et-2,et,2),t.fillRect(0,20,et,2),t.fillRect(0,42,et,2),t.fillStyle="rgba(120, 120, 130, 0.6)",t.fillRect(0,10,et,3),t.fillRect(0,50,et,3),t.fillStyle="rgba(160, 155, 150, 0.8)";for(const e of[6,30,54])for(const n of[10,50])t.fillRect(e,n,3,3);return t.fillStyle="rgba(20, 15, 10, 0.9)",t.beginPath(),t.arc(32,32,4,0,Math.PI*2),t.fill(),t.fillRect(31,32,3,8),ke(i)}function a_(){const[i,t]=ze();for(let e=0;e<et;e++)for(let n=0;n<et;n++){const s=ut(110,12),r=ut(105,10),o=ut(100,10);t.fillStyle=`rgb(${s},${r},${o})`,t.fillRect(n,e,1,1)}t.strokeStyle="rgba(60, 55, 50, 0.5)",t.lineWidth=1;for(let e=0;e<15;e++){const n=Math.floor(Math.random()*et),s=Math.floor(Math.random()*et),r=2+Math.floor(Math.random()*4);t.beginPath(),t.moveTo(n,s),t.lineTo(n+ut(0,2),s+r),t.stroke()}return ke(i)}let wo=null,bo=null,Eo=null;function l_(){return wo||(wo=r_()),wo}function c_(){return bo||(bo=o_()),bo}function u_(){return Eo||(Eo=a_()),Eo}function ri(i,t,e,n,s,r){let o="stone",a="stone_tile",c="dark_rock";if(n&&(n.wallTexture&&(o=n.wallTexture),n.floorTexture&&(a=n.floorTexture),n.ceilingTexture&&(c=n.ceilingTexture)),s){const l=s.get(e);l&&(l.wallTexture&&(o=l.wallTexture),l.floorTexture&&(a=l.floorTexture),l.ceilingTexture&&(c=l.ceilingTexture))}if(r)for(const l of r)i>=l.fromCol&&i<=l.toCol&&t>=l.fromRow&&t<=l.toRow&&(l.wallTexture&&(o=l.wallTexture),l.floorTexture&&(a=l.floorTexture),l.ceilingTexture&&(c=l.ceilingTexture));return{wall:o,floor:a,ceiling:c}}const Ea=["doors","keys","levers","plates","triggers","tripwires","gates","trapLaunchers","sconces","stairs","enemies","breakableWalls","secretWalls","blocks","chests","signs","npcs","fountains","bookshelves","altars","barrels","thinWalls","ramps","props","pitTraps","spawners","boulders","boulderSpawners"],_s="door,gate,trap_launcher,chest,pit_trap,spawner,boulder,boulder_spawner",qa=[{type:"door",layerKey:"doors",defaults:{state:"closed",gateMode:"or"},wire:{field:"keyId",validEntityType:"key"}},{type:"key",layerKey:"keys",defaults:{keyId:""},wire:{field:"keyId",validEntityType:"door,chest"}},{type:"lever",layerKey:"levers",defaults:{targets:[],wall:"N",signalMode:"toggle"},wire:{field:"targets",validEntityType:_s}},{type:"pressure_plate",layerKey:"plates",defaults:{targets:[],signalMode:"toggle"},wire:{field:"targets",validEntityType:_s}},{type:"trigger",layerKey:"triggers",defaults:{targets:[],signalMode:"momentary"},wire:{field:"targets",validEntityType:_s}},{type:"tripwire",layerKey:"tripwires",defaults:{targets:[],visibilityThreshold:8,orientation:"EW"},wire:{field:"targets",validEntityType:_s}},{type:"gate",layerKey:"gates",defaults:{gateType:"and",targets:[]},wire:{field:"targets",validEntityType:_s}},{type:"trap_launcher",layerKey:"trapLaunchers",defaults:{facing:"S",projectileType:"dart",fireMode:"repeat",reloadTime:3,maxRange:20}},{type:"torch_sconce",layerKey:"sconces",defaults:{wall:"N"}},{type:"enemy",layerKey:"enemies",defaults:{enemyType:"rat"}},{type:"equipment",defaults:{itemId:""}},{type:"consumable",defaults:{itemId:""}},{type:"stairs",layerKey:"stairs",defaults:{direction:"down",facing:"S",target:""},wire:{field:"target",validEntityType:"stairs"}},{type:"breakable_wall",layerKey:"breakableWalls",defaults:{hp:30}},{type:"secret_wall",layerKey:"secretWalls",defaults:{persistent:!1}},{type:"block",layerKey:"blocks",defaults:{}},{type:"chest",layerKey:"chests",defaults:{state:"closed",facing:"S"},wire:{field:"targets",validEntityType:"door,gate,trap_launcher,pit_trap,spawner,boulder,boulder_spawner"}},{type:"sign",layerKey:"signs",defaults:{wall:"N",text:""}},{type:"npc",layerKey:"npcs",defaults:{npcId:""}},{type:"fountain",layerKey:"fountains",defaults:{healAmount:20}},{type:"bookshelf",layerKey:"bookshelves",defaults:{wall:"N",text:""}},{type:"altar",layerKey:"altars",defaults:{buffType:"atk",buffAmount:5,buffDuration:60}},{type:"barrel",layerKey:"barrels",defaults:{hp:10}},{type:"ramp",layerKey:"ramps",defaults:{facing:"N",style:"ramp"}},{type:"pit_trap",layerKey:"pitTraps",defaults:{state:"closed"}},{type:"spawner",layerKey:"spawners",defaults:{enemyType:"rat",maxActive:3,interval:10,spawnRadius:2,active:!0,visible:!0}},{type:"boulder",layerKey:"boulders",defaults:{direction:"N",state:"rolling",rollDamage:30,fallDamage:60,instaKillEnemies:!0,pushable:!0}},{type:"boulder_spawner",layerKey:"boulderSpawners",defaults:{direction:"N",intervalMode:"fixed",interval:5,intervalMin:3,intervalMax:8,active:!0,rollDamage:30,fallDamage:60,instaKillEnemies:!0,pushable:!0}},{type:"prop",layerKey:"props",defaults:{propId:"pillar"}},{type:"thin_wall",layerKey:"thinWalls",defaults:{wall:"S",solid:!0,height:"full",texture:"stone_thin"}}];qa.map(i=>i.type);const jx=Object.fromEntries(qa.map(i=>[i.type,i.defaults])),Zx=Object.fromEntries(qa.filter(i=>i.wire).map(i=>[i.type,i.wire]));function Sc(i,t){if(t===null||typeof t!="object")return t;const e={...t};return i==="enemies"&&Array.isArray(e.statusEffects)&&(e.statusEffects=e.statusEffects.map(n=>n!==null&&typeof n=="object"?{...n}:n)),e}function Jx(i){const t=new Set(Ea);for(const e of Object.keys(i))if(i[e]instanceof Map&&!t.has(e))throw new Error(`Level snapshot collection "${e}" is not in the entity type registry and would be dropped on save`)}const qu=1.2;class h_{constructor(){it(this,"enemies");it(this,"loaded");this.enemies=new Map,this.loaded=!1}async load(){const t=await fetch("/data/enemies.json");if(!t.ok)throw new Error(`Failed to load enemy database: ${t.status} ${t.statusText}`);const e=await t.json();this.enemies=new Map;for(const n of e.enemies)this.enemies.set(n.id,n);this.loaded=!0}getEnemy(t){return this.enemies.get(t)}getAllEnemies(){return[...this.enemies.values()]}getAllEnemyIds(){return[...this.enemies.keys()]}isLoaded(){return this.loaded}hasBehavior(t,e){const n=this.enemies.get(t);return n?n.behaviors.some(s=>s.type===e):!1}getBehavior(t,e){const n=this.enemies.get(t);if(n)return n.behaviors.find(s=>s.type===e)}}const Pn=new h_;function f_(i,t,e){const n=Pn.getEnemy(e);if(!n)throw new Error(`Unknown enemy type: ${e}`);const s={col:i,row:t,type:n.id,hp:n.maxHp,maxHp:n.maxHp,atk:n.atk,def:n.def,aggroRange:n.aggroRange,moveInterval:n.moveInterval,blocksMovement:n.blocksMovement,aiState:"idle",moveTimer:0,statusEffects:[]};return Pn.hasBehavior(e,"regen")&&(s.regenTimer=0,s.regenPauseTimer=0),s}const d_=2;class p_{constructor(){it(this,"npcs");it(this,"loaded");this.npcs=new Map,this.loaded=!1}async load(){const t=await fetch("/data/npcs.json");if(!t.ok)throw new Error(`Failed to load NPC database: ${t.status} ${t.statusText}`);const e=await t.json();this.npcs=new Map;for(const n of e.npcs)this.npcs.set(n.id,n);this.loaded=!0}getNpc(t){return this.npcs.get(t)}getAllNpcs(){return[...this.npcs.values()]}getAllNpcIds(){return[...this.npcs.keys()]}isLoaded(){return this.loaded}}const Zi=new p_,m_=12;class g_{constructor(){it(this,"items");it(this,"_nextId");this.items=new Map,this._nextId=0}createItem(t,e,n,s=[]){const r=`item_${this._nextId++}`,o={instanceId:r,itemId:t,quality:e,modifiers:s,location:n};return this.items.set(r,o),o}addItem(t){this.items.set(t.instanceId,t)}removeItem(t){this.items.delete(t)}getItem(t){return this.items.get(t)}moveItem(t,e){const n=this.items.get(t);n&&(n.location=e)}getGroundItems(t,e,n){const s=[];for(const r of this.items.values()){const o=r.location;o.kind==="world"&&o.levelId===t&&o.col===e&&o.row===n&&s.push(r)}return s}getAllGroundItemsForLevel(t,e){const n=[];for(const s of this.items.values())if(s.location.kind==="world"&&s.location.levelId===t){if(e!==void 0&&(s.location.layerIndex??0)!==e)continue;n.push(s)}return n}getBackpackItems(){const t=[];for(const e of this.items.values())e.location.kind==="backpack"&&t.push(e);return t.sort((e,n)=>{const s=e.location.slot,r=n.location.slot;return s-r}),t}getBackpackItemAt(t){for(const e of this.items.values())if(e.location.kind==="backpack"&&e.location.slot===t)return e}swapBackpackSlots(t,e){const n=this.getBackpackItemAt(t),s=this.getBackpackItemAt(e);!n&&!s||(n&&s?(n.location={kind:"backpack",slot:e},s.location={kind:"backpack",slot:t}):n&&(n.location={kind:"backpack",slot:e}))}nextBackpackSlot(){const t=new Set;for(const e of this.items.values())e.location.kind==="backpack"&&t.add(e.location.slot);for(let e=0;e<m_;e++)if(!t.has(e))return e;return null}getEquipped(t){for(const e of this.items.values())if(e.location.kind==="equipped"&&e.location.slot===t)return e}getAllEquipped(){const t=new Map;for(const e of this.items.values())e.location.kind==="equipped"&&t.set(e.location.slot,e);return t}clearLevel(t){for(const[e,n]of this.items)n.location.kind==="world"&&n.location.levelId===t&&this.items.delete(e)}clear(){this.items.clear(),this._nextId=0}snapshot(){const t=[];for(const e of this.items.values())t.push({...e,modifiers:[...e.modifiers],location:{...e.location}});return t}restore(t){this.items.clear();let e=-1;for(const n of t){this.items.set(n.instanceId,{...n,modifiers:[...n.modifiers],location:{...n.location}});const s=parseInt(n.instanceId.replace("item_",""),10);!isNaN(s)&&s>e&&(e=s)}this._nextId=e+1}}class Ku{constructor(){it(this,"items");it(this,"loaded");this.items=new Map,this.loaded=!1}async load(){const t=await fetch("/data/items.json");if(!t.ok)throw new Error(`Failed to load item database: ${t.status} ${t.statusText}`);const e=await t.json();this.items=new Map;for(const n of e.items)this.items.set(n.id,n);this.loaded=!0}getItem(t){return this.items.get(t)}getItemsByType(t){const e=[];for(const n of this.items.values())n.type===t&&e.push(n);return e}getAllItems(){return[...this.items.values()]}isLoaded(){return this.loaded}}const fe=new Ku,Qx=Object.freeze(Object.defineProperty({__proto__:null,ItemDatabase:Ku,itemDatabase:fe},Symbol.toStringTag,{value:"Module"}));class __{constructor(){it(this,"sources",new Map);it(this,"receivers",new Map);it(this,"gates",new Map);it(this,"onReceiverChanged",null);it(this,"onSourceDeactivated",null);it(this,"now",0)}setReceiverChangedCallback(t){this.onReceiverChanged=t}setSourceDeactivatedCallback(t){this.onSourceDeactivated=t}registerSource(t,e,n="toggle",s,r){this.sources.set(t,{entityId:t,targets:e,signalMode:n,active:!1,fired:!1,duration:s,deactivateAt:0,delay:r,delayFireAt:0,delayPending:!1})}registerReceiver(t,e="or"){this.receivers.set(t,{entityId:t,gateMode:e,active:!1})}registerGate(t,e,n,s,r){this.gates.set(t,{entityId:t,gateType:e,targets:n,active:!1,delay:s,interval:r,fireAt:0,pendingActivation:!1})}setSourceActive(t,e){const n=this.sources.get(t);if(n&&!(n.signalMode==="one_shot"&&n.fired)){if(e&&n.delay&&n.delay>0&&!n.delayPending&&!n.active){n.delayPending=!0,n.delayFireAt=this.now+n.delay,n.signalMode==="one_shot"&&(n.fired=!0);return}e||(n.delayPending=!1,n.delayFireAt=0),n.active=e,e&&n.signalMode==="one_shot"&&!n.fired&&(n.fired=!0),e&&n.signalMode==="timed"&&n.duration&&(n.deactivateAt=this.now+n.duration),this.propagate()}}deactivateSource(t){const e=this.sources.get(t);e&&(e.active=!1,e.delayPending=!1,e.delayFireAt=0,e.deactivateAt=0,this.propagate())}tick(t){var n;this.now+=t;let e=!1;for(const s of this.sources.values())s.delayPending&&s.delayFireAt>0&&this.now>=s.delayFireAt&&(s.delayPending=!1,s.active=!0,s.signalMode==="timed"&&s.duration&&(s.deactivateAt=s.delayFireAt+s.duration),s.delayFireAt=0,e=!0);for(const s of this.sources.values())s.signalMode==="timed"&&s.active&&s.deactivateAt>0&&this.now>=s.deactivateAt&&(s.deactivateAt=0,s.active=!1,e=!0,(n=this.onSourceDeactivated)==null||n.call(this,s.entityId));for(const s of this.gates.values())s.gateType==="delay"&&s.pendingActivation&&s.fireAt>0&&this.now>=s.fireAt&&(s.fireAt=0,s.pendingActivation=!1,s.active=!0,e=!0),s.gateType==="pulse_repeat"&&s.active&&s.fireAt>0&&this.now>=s.fireAt&&(s.fireAt=s.fireAt+(s.interval??1),e=!0);e&&this.propagate()}isReceiverActive(t){const e=this.receivers.get(t);return e?e.active:!1}isSourceActive(t){const e=this.sources.get(t);return e?e.active:!1}getSource(t){return this.sources.get(t)}getReceiver(t){return this.receivers.get(t)}getGate(t){return this.gates.get(t)}clear(){this.sources.clear(),this.receivers.clear(),this.gates.clear(),this.now=0}saveState(){return{sources:Array.from(this.sources.entries()).map(([t,e])=>[t,{...e}]),receivers:Array.from(this.receivers.entries()).map(([t,e])=>[t,{...e}]),gates:Array.from(this.gates.entries()).map(([t,e])=>[t,{...e}]),now:this.now}}loadState(t){this.now=t.now??0,this.sources.clear();for(const[e,n]of t.sources)this.sources.set(e,{...n});this.receivers.clear();for(const[e,n]of t.receivers)this.receivers.set(e,{...n});this.gates.clear();for(const[e,n]of t.gates)this.gates.set(e,{...n})}propagate(){const t=new Set;this.propagateInternal(t)}propagateInternal(t){var s;const e=this.topologicalSortGates();for(const r of e){const o=[];for(const c of this.sources.values())c.targets.includes(r.entityId)&&o.push(c.active);for(const c of this.gates.values())c!==r&&c.targets.includes(r.entityId)&&o.push(c.active);const a=o.some(c=>c);switch(r.gateType){case"and":case"or":{const c=r.gateType==="and"?"and":"or";r.active=this.evaluateGateMode(c,o);break}case"not":r.active=!a;break;case"delay":a&&!r.pendingActivation&&!r.active&&(r.pendingActivation=!0,r.fireAt=this.now+(r.delay??0)),a||(r.pendingActivation=!1,r.active=!1);break;case"pulse_edge":r.active=a&&!r.active;break;case"pulse_repeat":a&&!r.active&&(r.active=!0,r.fireAt=this.now+(r.interval??1)),a||(r.active=!1);break}}const n=new Map;for(const r of this.sources.values())for(const o of r.targets)this.receivers.has(o)&&(n.has(o)||n.set(o,[]),n.get(o).push(r.active));for(const r of this.gates.values())for(const o of r.targets)this.receivers.has(o)&&(n.has(o)||n.set(o,[]),n.get(o).push(r.active));for(const r of this.receivers.values()){const o=n.get(r.entityId)??[],a=r.active;r.active=this.evaluateGateMode(r.gateMode,o),r.active!==a&&((s=this.onReceiverChanged)==null||s.call(this,r.entityId,r.active))}}topologicalSortGates(){const t=new Map;for(const s of this.gates.values())t.has(s.entityId)||t.set(s.entityId,0);for(const s of this.gates.values())for(const r of s.targets)this.gates.has(r)&&t.set(r,(t.get(r)??0)+1);const e=[];for(const[s,r]of t)r===0&&e.push(s);const n=[];for(;e.length>0;){const s=e.shift();n.push(this.gates.get(s));const r=this.gates.get(s);for(const o of r.targets)if(this.gates.has(o)){const a=(t.get(o)??1)-1;t.set(o,a),a===0&&e.push(o)}}return n}evaluateGateMode(t,e){if(e.length===0)return!1;switch(t){case"or":return e.some(n=>n);case"and":return e.every(n=>n);case"xor":return e.filter(n=>n).length%2===1;default:return e.some(n=>n)}}}const v_={poison:{type:"poison",tickTimer:0,tickInterval:1,tickDamage:2},slow:{type:"slow",tickTimer:0,tickInterval:0,tickDamage:0},burning:{type:"burning",tickTimer:0,tickInterval:1,tickDamage:3}};function tM(i,t,e){const n=i.find(s=>s.type===t);if(n)n.remaining=Math.max(n.remaining,e);else{const s=v_[t];i.push({...s,remaining:e})}}function eM(i,t){let e=0;const n=[];for(const s of i){if(s.remaining-=t,s.tickInterval>0&&s.tickDamage>0)for(s.tickTimer+=t;s.tickTimer>=s.tickInterval;)s.tickTimer-=s.tickInterval,e+=s.tickDamage;s.remaining<=0&&n.push(s.type)}return{damage:e,expiredTypes:n}}function wc(i,t){return i.filter(e=>e.type!==t)}function x_(i,t){return i.some(e=>e.type===t)}function nM(i){return x_(i,"slow")?2:1}function X(i,t){return`${i},${t}`}function vs(i,t,e){return`${i},${t}:${e}`}function iM(i,t){return`${i}:${t}`}function or(i,t,e,n){return!e||Ni(e,i,t-1,n,!1)?"N":Ni(e,i,t+1,n,!1)?"S":Ni(e,i+1,t,n,!1)?"E":Ni(e,i-1,t,n,!1)?"W":"N"}function M_(i,t,e,n){if(!e)return"EW";const s=Ni(e,i,t-1,n,!0),r=Ni(e,i,t+1,n,!0);return s&&r?"NS":"EW"}function ar(){return{doors:new Map,keys:new Map,levers:new Map,plates:new Map,triggers:new Map,tripwires:new Map,gates:new Map,trapLaunchers:new Map,sconces:new Map,stairs:new Map,enemies:new Map,breakableWalls:new Map,secretWalls:new Map,blocks:new Map,chests:new Map,signs:new Map,npcs:new Map,fountains:new Map,bookshelves:new Map,altars:new Map,barrels:new Map,thinWalls:new Map,ramps:new Map,props:new Map,pitTraps:new Map,spawners:new Map,boulders:new Map,boulderSpawners:new Map,destroyedWalls:new Set,exploredCells:new Set}}class sM{constructor(t,e,n="default",s,r){it(this,"layers");it(this,"activeLayerIndex");it(this,"charDefMap",new Map);it(this,"tempBuffs");it(this,"inventory");it(this,"flags");it(this,"entityById");it(this,"entityRegistry");it(this,"signalManager");it(this,"currentLevelId");it(this,"hp");it(this,"maxHp");it(this,"atk");it(this,"def");it(this,"attackCooldown");it(this,"torchFuel");it(this,"maxTorchFuel");it(this,"hunger");it(this,"maxHunger");it(this,"str");it(this,"dex");it(this,"vit");it(this,"wis");it(this,"xp");it(this,"level");it(this,"attributePoints");it(this,"playerName");it(this,"gold");it(this,"playerStatusEffects");it(this,"onDoorSignalChanged",null);it(this,"onPitTrapSignalChanged",null);it(this,"onSpawnerSignalChanged",null);it(this,"onBoulderSpawnerSignalChanged",null);it(this,"onBoulderSignalChanged",null);it(this,"onLeverReset",null);it(this,"onPlateReset",null);it(this,"onLauncherFire",null);it(this,"onChestSignalChanged",null);if(this.layers=[ar()],this.activeLayerIndex=0,r&&(this.charDefMap=Er(r)),this.tempBuffs=[],this.inventory=new Set,this.flags=new Set,this.entityById=new Map,this.entityRegistry=new g_,this.signalManager=new __,this.currentLevelId=n,this.str=5,this.dex=5,this.vit=5,this.wis=5,this.xp=0,this.level=1,this.attributePoints=0,this.playerName="Adventurer",this.gold=0,this.playerStatusEffects=[],this.atk=3,this.def=1,this.attackCooldown=0,this.torchFuel=200,this.maxTorchFuel=200,this.hunger=100,this.maxHunger=100,this.maxHp=40+this.vit*5,this.hp=this.maxHp,s&&s.length>0){this.layers=s.map(()=>ar());for(let o=0;o<s.length;o++)this.activeLayerIndex=o,this._parseEntities(s[o].entities,s[o].grid);this.activeLayerIndex=0}else this._parseEntities(t,e)}get activeLayer(){return this.layers[this.activeLayerIndex]}get doors(){return this.activeLayer.doors}set doors(t){this.activeLayer.doors=t}get keys(){return this.activeLayer.keys}set keys(t){this.activeLayer.keys=t}get levers(){return this.activeLayer.levers}set levers(t){this.activeLayer.levers=t}get plates(){return this.activeLayer.plates}set plates(t){this.activeLayer.plates=t}get triggers(){return this.activeLayer.triggers}set triggers(t){this.activeLayer.triggers=t}get tripwires(){return this.activeLayer.tripwires}set tripwires(t){this.activeLayer.tripwires=t}get gates(){return this.activeLayer.gates}set gates(t){this.activeLayer.gates=t}get trapLaunchers(){return this.activeLayer.trapLaunchers}set trapLaunchers(t){this.activeLayer.trapLaunchers=t}get sconces(){return this.activeLayer.sconces}set sconces(t){this.activeLayer.sconces=t}get stairs(){return this.activeLayer.stairs}set stairs(t){this.activeLayer.stairs=t}get enemies(){return this.activeLayer.enemies}set enemies(t){this.activeLayer.enemies=t}get breakableWalls(){return this.activeLayer.breakableWalls}set breakableWalls(t){this.activeLayer.breakableWalls=t}get secretWalls(){return this.activeLayer.secretWalls}set secretWalls(t){this.activeLayer.secretWalls=t}get blocks(){return this.activeLayer.blocks}set blocks(t){this.activeLayer.blocks=t}get chests(){return this.activeLayer.chests}set chests(t){this.activeLayer.chests=t}get signs(){return this.activeLayer.signs}set signs(t){this.activeLayer.signs=t}get npcs(){return this.activeLayer.npcs}set npcs(t){this.activeLayer.npcs=t}get fountains(){return this.activeLayer.fountains}set fountains(t){this.activeLayer.fountains=t}get bookshelves(){return this.activeLayer.bookshelves}set bookshelves(t){this.activeLayer.bookshelves=t}get altars(){return this.activeLayer.altars}set altars(t){this.activeLayer.altars=t}get barrels(){return this.activeLayer.barrels}set barrels(t){this.activeLayer.barrels=t}get thinWalls(){return this.activeLayer.thinWalls}set thinWalls(t){this.activeLayer.thinWalls=t}get ramps(){return this.activeLayer.ramps}set ramps(t){this.activeLayer.ramps=t}get props(){return this.activeLayer.props}set props(t){this.activeLayer.props=t}get pitTraps(){return this.activeLayer.pitTraps}set pitTraps(t){this.activeLayer.pitTraps=t}get spawners(){return this.activeLayer.spawners}set spawners(t){this.activeLayer.spawners=t}get boulders(){return this.activeLayer.boulders}set boulders(t){this.activeLayer.boulders=t}get boulderSpawners(){return this.activeLayer.boulderSpawners}set boulderSpawners(t){this.activeLayer.boulderSpawners=t}get destroyedWalls(){return this.activeLayer.destroyedWalls}set destroyedWalls(t){this.activeLayer.destroyedWalls=t}get exploredCells(){return this.activeLayer.exploredCells}set exploredCells(t){this.activeLayer.exploredCells=t}_parseEntities(t,e){for(const s of t)this._parseSignalEntity(s,e)||this._parseEnvironmentEntity(s,e)||this._parseStructureEntity(s,e)||this._parseNpcEntity(s,e)||this._parseItemEntity(s);this._rebuildEntityIndex();const n=s=>{for(const r of s){const o=this.resolveEntityPosition(r);if(o){const a=this.getDoor(o.col,o.row);a&&(a.mechanical=!0);const c=this.getChest(o.col,o.row);c&&!c.gateMode&&(c.gateMode="or")}}};for(const s of this.levers.values())n(s.targets);for(const s of this.plates.values())n(s.targets);for(const s of this.triggers.values())n(s.targets);for(const s of this.tripwires.values())n(s.targets);for(const s of this.gates.values())n(s.targets);for(const s of this.chests.values())s.targets&&n(s.targets);this._initSignalManager()}_parseSignalEntity(t,e){if(t.type==="door"){const n=t.state??"closed",s=t.keyId;return this.doors.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,state:n,keyId:s,mechanical:!1,gateMode:t.gateMode}),!0}if(t.type==="key")return this.keys.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,keyId:t.keyId,pickedUp:!1}),!0;if(t.type==="lever"){const n=t.wall??or(t.col,t.row,e,this.charDefMap),s=t.targets??(t.target?[t.target]:t.targetDoor?[t.targetDoor]:[]);return this.levers.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,targets:s,wall:n,state:"up",signalMode:t.signalMode,signalDuration:t.signalDuration,signalDelay:t.signalDelay}),!0}if(t.type==="pressure_plate"){const n=t.targets??(t.target?[t.target]:t.targetDoor?[t.targetDoor]:[]);return this.plates.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,targets:n,activated:!1,signalMode:t.signalMode,signalDuration:t.signalDuration,signalDelay:t.signalDelay}),!0}if(t.type==="trigger"){const n=t.targets??[];return this.triggers.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,targets:n,signalMode:t.signalMode??"momentary",signalDuration:t.signalDuration,signalDelay:t.signalDelay,fired:!1}),!0}if(t.type==="tripwire"){const n=t.targets??[],s=t.orientation??M_(t.col,t.row,e,this.charDefMap);return this.tripwires.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,targets:n,signalMode:t.signalMode??"one_shot",signalDuration:t.signalDuration,signalDelay:t.signalDelay,visibilityThreshold:t.visibilityThreshold??8,orientation:s,triggered:!1}),!0}if(t.type==="gate"){const n=t.targets??[];return this.gates.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,gateType:t.gateType??"and",targets:n,delay:t.delay,interval:t.interval}),!0}return!1}_parseEnvironmentEntity(t,e){if(t.type==="trap_launcher")return this.trapLaunchers.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,facing:t.facing??"S",projectileType:t.projectileType??"dart",fireMode:t.fireMode??"repeat",reloadTime:t.reloadTime??3,nextFireAt:0,maxRange:t.maxRange}),!0;if(t.type==="torch_sconce"){const n=t.wall??or(t.col,t.row,e,this.charDefMap);return this.sconces.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,wall:n,lit:!0}),!0}return t.type==="stairs"?(this.stairs.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,direction:t.direction,facing:t.facing}),!0):!1}_parseStructureEntity(t,e){if(t.type==="breakable_wall"){const n=t.hp??30;return this.breakableWalls.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,hp:n,maxHp:n,drops:t.drops}),!0}if(t.type==="secret_wall")return this.secretWalls.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,opened:!1,persistent:t.persistent??!1}),!0;if(t.type==="block")return this.blocks.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row}),!0;if(t.type==="chest")return this.chests.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,state:t.state??"closed",facing:t.facing??"S",keyId:t.keyId,gateMode:t.gateMode,targets:t.targets,drops:t.drops}),!0;if(t.type==="sign"){const n=t.wall??or(t.col,t.row,e,this.charDefMap);return this.signs.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,wall:n,text:t.text??""}),!0}if(t.type==="thin_wall"){const n=t.wall??"S";return this.thinWalls.set(vs(t.col,t.row,n),{id:t.id,col:t.col,row:t.row,wall:n,solid:t.solid??!0,height:t.height??"full",texture:t.texture??"stone_thin",textureBack:t.textureBack}),!0}if(t.type==="ramp")return this.ramps.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,facing:t.facing??"N",style:t.style??"ramp"}),!0;if(t.type==="prop")return this.props.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,propId:t.propId??"pillar",wall:t.wall,rotation:t.rotation??void 0}),!0;if(t.type==="pit_trap")return this.pitTraps.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,state:t.state??"closed",gateMode:t.gateMode??void 0}),!0;if(t.type==="spawner")return this.spawners.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,enemyType:t.enemyType??"rat",maxActive:t.maxActive??3,interval:t.interval??10,spawnRadius:t.spawnRadius??2,active:t.active!==!1,visible:t.visible!==!1,gateMode:t.gateMode,spawnTimer:0}),!0;if(t.type==="boulder")return this.boulders.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,direction:t.direction??"N",state:t.state??"idle",gateMode:t.gateMode,rollDamage:t.rollDamage??30,fallDamage:t.fallDamage??60,instaKillEnemies:t.instaKillEnemies!==!1,pushable:t.pushable===!0}),!0;if(t.type==="boulder_spawner"){const n=t.intervalMode??"fixed",s=t.interval??5,r=t.intervalMin??3,o=t.intervalMax??8,a=n==="random"?r+Math.random()*Math.max(0,o-r):s;return this.boulderSpawners.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,direction:t.direction??"N",intervalMode:n,interval:s,intervalMin:r,intervalMax:o,active:t.active!==!1,gateMode:t.gateMode,spawnTimer:0,nextInterval:a,rollDamage:t.rollDamage??30,fallDamage:t.fallDamage??60,instaKillEnemies:t.instaKillEnemies!==!1,pushable:t.pushable===!0}),!0}return!1}_parseNpcEntity(t,e){if(t.type==="npc"){const n=t.npcId;return Zi.getNpc(n)&&this.npcs.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,npcId:n}),!0}if(t.type==="fountain")return this.fountains.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,state:t.state??"active",healAmount:t.healAmount??20}),!0;if(t.type==="bookshelf"){const n=t.wall??or(t.col,t.row,e,this.charDefMap);return this.bookshelves.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,wall:n,text:t.text??""}),!0}if(t.type==="altar")return this.altars.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,state:t.state??"active",buffType:t.buffType??"atk",buffAmount:t.buffAmount??5,buffDuration:t.buffDuration??60}),!0;if(t.type==="barrel"){const n=t.hp??10;return this.barrels.set(X(t.col,t.row),{id:t.id,col:t.col,row:t.row,hp:n,maxHp:n,drops:t.drops}),!0}return!1}_parseItemEntity(t){if(t.type==="enemy"){const e=t.enemyType;if(Pn.getEnemy(e)){const n=f_(t.col,t.row,e);t.drops&&(n.drops=t.drops),this.enemies.set(X(t.col,t.row),n)}return!0}if(t.type==="equipment"||t.type==="consumable"){const e={kind:"world",levelId:this.currentLevelId,col:t.col,row:t.row,layerIndex:this.activeLayerIndex};return this.entityRegistry.createItem(t.itemId,"common",e),!0}return!1}_initSignalManager(){this.signalManager.clear();const t=this.activeLayerIndex,e=new Set;for(const n of this.layers){const s=[...n.levers.values(),...n.plates.values(),...n.triggers.values(),...n.tripwires.values(),...n.gates.values(),...n.chests.values()];for(const r of s)if(r.targets)for(const o of r.targets)e.add(o)}for(let n=0;n<this.layers.length;n++){this.activeLayerIndex=n;for(const s of this.levers.values())s.id&&this.signalManager.registerSource(s.id,s.targets,s.signalMode??"toggle",s.signalDuration,s.signalDelay);for(const s of this.plates.values())s.id&&this.signalManager.registerSource(s.id,s.targets,s.signalMode??"toggle",s.signalDuration,s.signalDelay);for(const s of this.triggers.values())s.id&&this.signalManager.registerSource(s.id,s.targets,s.signalMode,s.signalDuration,s.signalDelay);for(const s of this.tripwires.values())s.id&&this.signalManager.registerSource(s.id,s.targets,s.signalMode,s.signalDuration,s.signalDelay);for(const s of this.gates.values())s.id&&this.signalManager.registerGate(s.id,s.gateType,s.targets,s.delay,s.interval);for(const s of this.doors.values())s.id&&s.mechanical&&this.signalManager.registerReceiver(s.id,s.gateMode??"or");for(const s of this.trapLaunchers.values())s.id&&this.signalManager.registerReceiver(s.id,"or");for(const s of this.chests.values())s.id&&s.gateMode&&this.signalManager.registerReceiver(s.id,s.gateMode);for(const s of this.pitTraps.values())s.id&&this.signalManager.registerReceiver(s.id,s.gateMode??"or");for(const s of this.spawners.values())s.id&&e.has(s.id)&&this.signalManager.registerReceiver(s.id,s.gateMode??"or");for(const s of this.boulderSpawners.values())s.id&&e.has(s.id)&&this.signalManager.registerReceiver(s.id,s.gateMode??"or");for(const s of this.boulders.values())s.id&&e.has(s.id)&&this.signalManager.registerReceiver(s.id,s.gateMode??"or");for(const s of this.chests.values())s.id&&s.targets&&s.targets.length>0&&this.signalManager.registerSource(s.id,s.targets,"toggle")}this.activeLayerIndex=t,this.signalManager.setReceiverChangedCallback((n,s)=>{var p,_,g,h,S,b,x,P;const r=this.entityById.get(n);if(!r)return;const o=this.activeLayerIndex;this.activeLayerIndex=r.layerIndex;const a=this.getDoor(r.col,r.row);if(a){a.state=s?"open":"closed",(p=this.onDoorSignalChanged)==null||p.call(this,r.col,r.row,s),this.activeLayerIndex=o;return}const c=this.chests.get(X(r.col,r.row));if(c){s?(c.state="open",this._activateChestSignal(c),(_=this.onChestSignalChanged)==null||_.call(this,r.col,r.row,!0)):(c.state="closed",(g=this.onChestSignalChanged)==null||g.call(this,r.col,r.row,!1)),this.activeLayerIndex=o;return}const l=this.trapLaunchers.get(X(r.col,r.row));l&&s&&l.nextFireAt===0&&((h=this.onLauncherFire)==null||h.call(this,l),l.fireMode==="repeat"&&(l.nextFireAt=this.signalManager.now+l.reloadTime)),l&&!s&&(l.nextFireAt=0);const u=this.pitTraps.get(X(r.col,r.row));u&&(u.state=s?"open":"closed",(S=this.onPitTrapSignalChanged)==null||S.call(this,r.col,r.row,s));const f=this.spawners.get(X(r.col,r.row));f&&(f.active=s,(b=this.onSpawnerSignalChanged)==null||b.call(this,r.col,r.row,s));const d=this.boulderSpawners.get(X(r.col,r.row));d&&(d.active=s,(x=this.onBoulderSpawnerSignalChanged)==null||x.call(this,r.col,r.row,s));const m=this.boulders.get(X(r.col,r.row));m&&s&&m.state==="idle"&&(m.state="rolling",(P=this.onBoulderSignalChanged)==null||P.call(this,r.col,r.row,!0)),this.activeLayerIndex=o}),this.signalManager.setSourceDeactivatedCallback(n=>{var l,u;const s=this.entityById.get(n);if(!s)return;const r=this.activeLayerIndex;this.activeLayerIndex=s.layerIndex;const o=this.getLever(s.col,s.row);o&&o.state==="down"&&(o.state="up",(l=this.onLeverReset)==null||l.call(this,s.col,s.row));const a=this.plates.get(X(s.col,s.row));a&&a.activated&&(a.activated=!1,(u=this.onPlateReset)==null||u.call(this,s.col,s.row));const c=this.triggers.get(X(s.col,s.row));c&&c.fired&&(c.fired=!1),this.activeLayerIndex=r}),this.signalManager.propagate(),this.syncSignalReceiverStates()}syncSignalReceiverStates(){const t=this.activeLayerIndex;for(let e=0;e<this.layers.length;e++){this.activeLayerIndex=e;for(const n of this.pitTraps.values()){if(!n.id||!this.signalManager.getReceiver(n.id))continue;const s=this.signalManager.isReceiverActive(n.id);n.state=s?"open":"closed"}for(const n of this.spawners.values()){if(!n.id||!this.signalManager.getReceiver(n.id))continue;const s=this.signalManager.isReceiverActive(n.id);n.active=s}for(const n of this.boulderSpawners.values()){if(!n.id||!this.signalManager.getReceiver(n.id))continue;const s=this.signalManager.isReceiverActive(n.id);n.active=s}for(const n of this.doors.values()){if(!n.id||!n.mechanical||!this.signalManager.getReceiver(n.id))continue;const s=this.signalManager.isReceiverActive(n.id);n.state=s?"open":"closed"}}this.activeLayerIndex=t}_rebuildEntityIndex(){this.entityById.clear();const t=(n,s,r)=>{n.id&&this.entityById.set(n.id,{col:n.col,row:n.row,type:s,layerIndex:r})},e=this.activeLayerIndex;for(let n=0;n<this.layers.length;n++){this.activeLayerIndex=n;for(const s of this.doors.values())t(s,"door",n);for(const s of this.keys.values())t(s,"key",n);for(const s of this.levers.values())t(s,"lever",n);for(const s of this.plates.values())t(s,"pressure_plate",n);for(const s of this.triggers.values())t(s,"trigger",n);for(const s of this.tripwires.values())t(s,"tripwire",n);for(const s of this.gates.values())t(s,"gate",n);for(const s of this.trapLaunchers.values())t(s,"trap_launcher",n);for(const s of this.sconces.values())t(s,"torch_sconce",n);for(const s of this.stairs.values())t(s,"stairs",n);for(const s of this.breakableWalls.values())t(s,"breakable_wall",n);for(const s of this.secretWalls.values())t(s,"secret_wall",n);for(const s of this.blocks.values())t(s,"block",n);for(const s of this.chests.values())t(s,"chest",n);for(const s of this.signs.values())t(s,"sign",n);for(const s of this.npcs.values())t(s,"npc",n);for(const s of this.fountains.values())t(s,"fountain",n);for(const s of this.bookshelves.values())t(s,"bookshelf",n);for(const s of this.altars.values())t(s,"altar",n);for(const s of this.barrels.values())t(s,"barrel",n);for(const s of this.thinWalls.values())t(s,"thin_wall",n);for(const s of this.ramps.values())t(s,"ramp",n);for(const s of this.props.values())t(s,"prop",n);for(const s of this.pitTraps.values())t(s,"pit_trap",n);for(const s of this.spawners.values())t(s,"spawner",n);for(const s of this.boulders.values())t(s,"boulder",n);for(const s of this.boulderSpawners.values())t(s,"boulder_spawner",n)}this.activeLayerIndex=e}resolveEntityPosition(t){return this.entityById.get(t)}getThinWallBetween(t,e,n,s){const r=n-t,o=s-e;if(r===0&&o===1)return this.thinWalls.get(vs(t,e,"S"));if(r===0&&o===-1)return this.thinWalls.get(vs(n,s,"S"));if(r===1&&o===0)return this.thinWalls.get(vs(t,e,"E"));if(r===-1&&o===0)return this.thinWalls.get(vs(n,s,"E"))}isEdgeBlocked(t,e,n,s){return this.getThinWallBetween(t,e,n,s)!==void 0}isSolidEdgeBlocked(t,e,n,s){const r=this.getThinWallBetween(t,e,n,s);return r!==void 0&&r.solid}_snapshotActiveLayer(t=!1){const e={};for(const n of Ea){const s=this.activeLayer[n],r=new Map;for(const[o,a]of s)r.set(o,Sc(n,a));e[n]=r}return e.destroyedWalls=new Set(this.destroyedWalls),e.exploredCells=new Set(this.exploredCells),e.registrySnapshot=t?this.entityRegistry.snapshot():[],e.signalState=t?this.signalManager.saveState():void 0,e}saveLevelState(){const t=this.activeLayerIndex,e=[];for(let n=0;n<this.layers.length;n++)this.activeLayerIndex=n,e.push(this._snapshotActiveLayer(n===0));return this.activeLayerIndex=t,{layers:e,activeLayerIndex:t}}_restoreActiveLayer(t){const e=t;for(const n of Ea){const s=e[n],r=new Map;if(s)for(const[o,a]of s)r.set(o,Sc(n,a));this.activeLayer[n]=r}this.destroyedWalls=new Set(t.destroyedWalls),this.exploredCells=new Set(t.exploredCells)}loadLevelState(t){this.layers=t.layers.map(()=>ar());for(let e=0;e<t.layers.length;e++)this.activeLayerIndex=e,this._restoreActiveLayer(t.layers[e]);this.activeLayerIndex=t.activeLayerIndex,t.layers[0].registrySnapshot&&this.entityRegistry.restore(t.layers[0].registrySnapshot),this._rebuildEntityIndex(),this._initSignalManager(),t.layers[0].signalState&&(this.signalManager.loadState(t.layers[0].signalState),this.syncSignalReceiverStates())}loadNewLevel(t,e,n){n&&(this.charDefMap=Er(n));const s=this.currentLevelId;e&&(this.currentLevelId=e),this.entityRegistry.clearLevel(s),this.entityById=new Map,this.layers=t.map(()=>ar());for(let r=0;r<t.length;r++)this.activeLayerIndex=r,this._parseEntities(t[r].entities,t[r].grid);this.activeLayerIndex=0}drainTorchFuel(t){this.torchFuel=Math.max(0,this.torchFuel-t)}drainHunger(t){this.hunger=Math.max(0,this.hunger-t)}restoreHunger(t){this.hunger=Math.min(this.maxHunger,this.hunger+t)}getDoor(t,e){return this.doors.get(X(t,e))}getStair(t,e){return this.stairs.get(X(t,e))}isDoorOpen(t,e){const n=this.getDoor(t,e);return n?n.state==="open":!0}openDoor(t,e){const n=this.getDoor(t,e);return!n||n.state!=="closed"||n.mechanical||n.keyId&&!this.hasKey(n.keyId)?!1:(n.state="open",!0)}closeDoor(t,e){const n=this.getDoor(t,e);return!n||n.state!=="open"||n.mechanical||this.isBlockedByEnemy(t,e)?!1:(n.state="closed",!0)}toggleDoor(t,e){const n=this.getDoor(t,e);n&&(n.state==="open"?n.state="closed":n.state==="closed"&&(n.state="open"))}addKey(t){this.inventory.add(t)}hasKey(t){return this.inventory.has(t)}pickupKeyAt(t,e){const n=this.keys.get(X(t,e));if(!(!n||n.pickedUp))return n.pickedUp=!0,this.addKey(n.keyId),n.keyId}getLever(t,e){return this.levers.get(X(t,e))}activateLever(t,e){const n=this.levers.get(X(t,e));if(n){if(n.state=n.state==="up"?"down":"up",n.id&&this.signalManager.getSource(n.id)){const s=n.state==="down";this.signalManager.setSourceActive(n.id,s)}else for(const s of n.targets){const r=this.resolveEntityPosition(s);r&&this.toggleDoor(r.col,r.row)}return n.targets}}activatePressurePlate(t,e){var r;const n=this.plates.get(X(t,e));if(!n)return;const s=n.signalMode??"toggle";if(s==="toggle")return n.activated=!n.activated,n.id&&this.signalManager.getSource(n.id)&&this.signalManager.setSourceActive(n.id,n.activated),n.activated||(r=this.onPlateReset)==null||r.call(this,t,e),n.targets;if(!n.activated){if(n.activated=!0,n.id&&this.signalManager.getSource(n.id)){if(this.signalManager.setSourceActive(n.id,!0),s==="timed"){const o=this.signalManager.getSource(n.id);o&&(o.deactivateAt=0)}}else for(const o of n.targets){const a=this.resolveEntityPosition(o);if(a){const c=this.getDoor(a.col,a.row);c&&c.state==="closed"&&(c.state="open")}}return n.targets}}deactivatePressurePlate(t,e){var r;const n=this.plates.get(X(t,e));if(!n||!n.activated)return;const s=n.signalMode??"toggle";if(s==="momentary")n.activated=!1,n.id&&this.signalManager.getSource(n.id)&&this.signalManager.deactivateSource(n.id),(r=this.onPlateReset)==null||r.call(this,t,e);else if(s==="timed"){const o=n.id?this.signalManager.getSource(n.id):void 0;o&&o.active&&o.duration&&(o.deactivateAt=this.signalManager.now+o.duration)}}activateTrigger(t,e){const n=this.triggers.get(X(t,e));if(!n)return!1;const s=n.signalMode??"momentary";if(s==="toggle")return n.fired=!n.fired,n.id&&this.signalManager.getSource(n.id)&&this.signalManager.setSourceActive(n.id,n.fired),!0;if(s==="one_shot"&&n.fired||n.fired)return!1;if(n.fired=!0,n.id&&this.signalManager.getSource(n.id)&&(this.signalManager.setSourceActive(n.id,!0),s==="timed")){const r=this.signalManager.getSource(n.id);r&&(r.deactivateAt=0)}return!0}deactivateTrigger(t,e){const n=this.triggers.get(X(t,e));if(!n||!n.fired)return;const s=n.signalMode??"momentary";if(s==="momentary")n.fired=!1,n.id&&this.signalManager.getSource(n.id)&&this.signalManager.deactivateSource(n.id);else if(s==="timed"){const r=n.id?this.signalManager.getSource(n.id):void 0;r&&r.active&&r.duration&&(r.deactivateAt=this.signalManager.now+r.duration)}}activateTripwire(t,e){const n=this.tripwires.get(X(t,e));return!n||n.triggered?!1:(n.triggered=!0,n.id&&this.signalManager.getSource(n.id)&&this.signalManager.setSourceActive(n.id,!0),!0)}tickTrapLaunchers(){var e;const t=this.signalManager.now;for(const n of this.trapLaunchers.values())n.fireMode==="repeat"&&n.nextFireAt>0&&t>=n.nextFireAt&&n.id&&(this.signalManager.isReceiverActive(n.id)?(n.nextFireAt=n.nextFireAt+n.reloadTime,(e=this.onLauncherFire)==null||e.call(this,n)):n.nextFireAt=0)}getSconce(t,e){return this.sconces.get(X(t,e))}takeSconceTorch(t,e){const n=this.sconces.get(X(t,e));return!n||!n.lit?!1:(n.lit=!1,this.torchFuel=this.maxTorchFuel,!0)}getBreakableWall(t,e){return this.breakableWalls.get(X(t,e))}damageBreakableWall(t,e,n,s){const r=this.breakableWalls.get(X(t,e));return r?(r.hp=Math.max(0,r.hp-n),r.hp<=0?(this.breakableWalls.delete(X(t,e)),s[e]=s[e].substring(0,t)+"."+s[e].substring(t+1),this.destroyedWalls.add(X(t,e)),{destroyed:!0,drops:r.drops}):{destroyed:!1}):{destroyed:!1}}getSecretWall(t,e){return this.secretWalls.get(X(t,e))}openSecretWall(t,e,n){const s=this.secretWalls.get(X(t,e));return!s||s.opened?{opened:!1,persistent:!1}:(s.opened=!0,n[e]=n[e].substring(0,t)+"."+n[e].substring(t+1),this.destroyedWalls.add(X(t,e)),{opened:!0,persistent:s.persistent})}getBlock(t,e){return this.blocks.get(X(t,e))}isBlockAt(t,e){return this.blocks.has(X(t,e))}pushBlock(t,e,n,s){const r=X(t,e),o=this.blocks.get(r);return o?(this.blocks.delete(r),o.col=n,o.row=s,this.blocks.set(X(n,s),o),this.activatePressurePlate(n,s),!0):!1}getChest(t,e){return this.chests.get(X(t,e))}openChest(t,e){const n=this.chests.get(X(t,e));return n?n.state==="open"?{opened:!1}:n.state==="locked"||n.keyId?n.keyId&&this.hasKey(n.keyId)?(this.inventory.delete(n.keyId),n.state="open",this._activateChestSignal(n),{opened:!0,drops:n.drops}):{opened:!1,locked:!0}:(n.state="open",this._activateChestSignal(n),{opened:!0,drops:n.drops}):{opened:!1}}_activateChestSignal(t){t.id&&t.targets&&t.targets.length>0&&this.signalManager.setSourceActive(t.id,!0)}destroyChest(t,e){const n=X(t,e),s=this.chests.get(n);if(s)return s.state!=="open"&&this._activateChestSignal(s),this.chests.delete(n),{drops:s.drops}}getSign(t,e){return this.signs.get(X(t,e))}getSignOnWall(t,e,n){const s=this.signs.get(X(t,e));if(s&&s.wall===n)return s}getNpc(t,e){return this.npcs.get(X(t,e))}isNpcAt(t,e){return this.npcs.has(X(t,e))}getFountain(t,e){return this.fountains.get(X(t,e))}useFountain(t,e){const n=this.fountains.get(X(t,e));return!n||n.state==="used"?{healed:!1,healAmount:0}:(this.hp=Math.min(this.maxHp,this.hp+n.healAmount),n.state="used",{healed:!0,healAmount:n.healAmount})}getBookshelfOnWall(t,e,n){const s=this.bookshelves.get(X(t,e));if(s&&s.wall===n)return s}getAltar(t,e){return this.altars.get(X(t,e))}useAltar(t,e){const n=this.altars.get(X(t,e));return!n||n.state==="used"?{activated:!1,buffType:"atk",buffAmount:0,buffDuration:0}:(n.state="used",this.addTempBuff(n.buffType,n.buffAmount,n.buffDuration),{activated:!0,buffType:n.buffType,buffAmount:n.buffAmount,buffDuration:n.buffDuration})}getBarrel(t,e){return this.barrels.get(X(t,e))}isBarrelAt(t,e){return this.barrels.has(X(t,e))}isBoulderAt(t,e){return this.boulders.has(X(t,e))}damageBarrel(t,e,n){const s=this.barrels.get(X(t,e));return s?(s.hp=Math.max(0,s.hp-n),s.hp<=0?(this.barrels.delete(X(t,e)),{destroyed:!0,drops:s.drops}):{destroyed:!1}):{destroyed:!1}}addTempBuff(t,e,n){this.tempBuffs=this.tempBuffs.filter(s=>s.stat!==t),this.tempBuffs.push({stat:t,amount:e,remaining:n})}tickTempBuffs(t){for(const e of this.tempBuffs)e.remaining-=t;this.tempBuffs=this.tempBuffs.filter(e=>e.remaining>0)}getTempBuffTotal(t){let e=0;for(const n of this.tempBuffs)n.stat===t&&(e+=n.amount);return e}hasFlag(t){return this.flags.has(t)}setFlag(t){this.flags.add(t)}removeFlag(t){this.flags.delete(t)}getEnemy(t,e){return this.enemies.get(X(t,e))}isEnemyAt(t,e){return this.enemies.has(X(t,e))}isBlockedByEnemy(t,e){const n=this.enemies.get(X(t,e));return n?n.blocksMovement:!1}moveEnemy(t,e,n,s){const r=X(t,e),o=this.enemies.get(r);o&&(this.enemies.delete(r),o.col=n,o.row=s,this.enemies.set(X(n,s),o))}damageEnemy(t,e,n){var r;const s=this.getEnemy(t,e);return s?(s.hp-=n,s.regenPauseTimer!==void 0&&(s.regenPauseTimer=((r=Pn.getBehavior(s.type,"regen"))==null?void 0:r.params.pauseOnDamage)??3),s.hp<=0?(this.enemies.delete(X(t,e)),!0):!1):!1}getEffectiveStats(){let t=0,e=0,n=0,s=0,r=0,o=0,a=0,c=0;if(fe.isLoaded())for(const[,h]of this.entityRegistry.getAllEquipped()){const S=fe.getItem(h.itemId);S&&(S.stats.str&&(t+=S.stats.str),S.stats.dex&&(e+=S.stats.dex),S.stats.vit&&(n+=S.stats.vit),S.stats.wis&&(s+=S.stats.wis),S.stats.atk&&(r+=S.stats.atk),S.stats.def&&(o+=S.stats.def),S.stats.hp&&(a+=S.stats.hp),S.stats.critChance&&(c+=S.stats.critChance))}const l=this.str+t+this.getTempBuffTotal("str"),u=this.dex+e+this.getTempBuffTotal("dex"),f=this.vit+n+this.getTempBuffTotal("vit"),d=this.wis+s+this.getTempBuffTotal("wis"),m=Math.floor(l/2),p=Math.floor(f/4),_=5+Math.floor(u/3),g=Math.max(0,Math.min(25,Math.floor((u-5)/4)));return{atk:r+m+this.getTempBuffTotal("atk"),def:o+p+this.getTempBuffTotal("def"),maxHp:40+f*5+a,critChance:_+c,dodgeChance:g,effectiveStr:l,effectiveDex:u,effectiveVit:f,effectiveWis:d}}getEffectiveAtk(){return this.getEffectiveStats().atk}getEffectiveDef(){return this.getEffectiveStats().def}getEquippedWeaponDef(){if(!fe.isLoaded())return;const t=this.entityRegistry.getEquipped("weapon");if(t)return fe.getItem(t.itemId)}canEquipItem(t){const e=t.requirements;if(!e)return{allowed:!0};const n=this.getEffectiveStats();return e.str&&n.effectiveStr<e.str?{allowed:!1,reason:`Requires ${e.str} STR (you have ${n.effectiveStr})`}:e.dex&&n.effectiveDex<e.dex?{allowed:!1,reason:`Requires ${e.dex} DEX (you have ${n.effectiveDex})`}:e.vit&&n.effectiveVit<e.vit?{allowed:!1,reason:`Requires ${e.vit} VIT (you have ${n.effectiveVit})`}:e.wis&&n.effectiveWis<e.wis?{allowed:!1,reason:`Requires ${e.wis} WIS (you have ${n.effectiveWis})`}:{allowed:!0}}xpForLevel(t){return 100*t*(t+1)/2}addXp(t){if(this.level>=15)return!1;this.xp+=t;let n=!1;for(;this.level<15&&this.xp>=this.xpForLevel(this.level);)this.level++,this.attributePoints+=3,this.maxHp=this.getEffectiveStats().maxHp,n=!0;return n}allocatePoint(t){if(this.attributePoints<=0)return!1;if(this.attributePoints--,t==="vit"){const e=this.hp===this.maxHp;this.vit++,this.maxHp=this.getEffectiveStats().maxHp,e&&(this.hp=this.maxHp)}else t==="str"?this.str++:t==="dex"?this.dex++:this.wis++;return!0}applyCharacterSetup(t,e,n,s,r){this.str=t,this.dex=e,this.vit=n,this.wis=s,this.playerName=r,this.maxHp=this.getEffectiveStats().maxHp,this.hp=this.maxHp}equipFromBackpack(t){const e=this.entityRegistry.getBackpackItems();if(t<0||t>=e.length)return{success:!1};const n=e[t];if(!fe.isLoaded())return{success:!1};const s=fe.getItem(n.itemId);if(!s)return{success:!1};const r=bc(s.subtype,this),o=this.canEquipItem(s);if(!o.allowed)return{success:!1,reason:o.reason};const a=n.location.slot,c=this.entityRegistry.getEquipped(r);return c&&this.entityRegistry.moveItem(c.instanceId,{kind:"backpack",slot:a}),this.entityRegistry.moveItem(n.instanceId,{kind:"equipped",slot:r}),this.maxHp=this.getEffectiveStats().maxHp,{success:!0,swappedToSlot:c?a:void 0}}unequipToBackpack(t,e){const n=this.entityRegistry.getEquipped(t);if(!n)return{success:!1};const s=e??this.entityRegistry.nextBackpackSlot();return s===null?{success:!1,reason:"Backpack is full"}:(this.entityRegistry.moveItem(n.instanceId,{kind:"backpack",slot:s}),this.maxHp=this.getEffectiveStats().maxHp,{success:!0})}dropItem(t,e,n){return this.entityRegistry.getItem(t)?(this.entityRegistry.moveItem(t,{kind:"world",levelId:this.currentLevelId,col:e,row:n,layerIndex:this.activeLayerIndex}),this.maxHp=this.getEffectiveStats().maxHp,!0):!1}useConsumableFromRegistry(t){var s,r,o;const e=this.entityRegistry.getItem(t);if(!e||!fe.isLoaded())return!1;const n=fe.getItem(e.itemId);return!n||n.type!=="consumable"?!1:(n.subtype==="health_potion"?this.hp=Math.min(this.maxHp,this.hp+(n.stats.hp??0)):n.subtype==="torch_oil"&&(this.torchFuel=Math.min(this.maxTorchFuel,this.torchFuel+(((s=n.effect)==null?void 0:s.torchFuel)??0))),(r=n.effect)!=null&&r.restoreHunger&&this.restoreHunger(n.effect.restoreHunger),(o=n.effect)!=null&&o.curePoison&&(this.playerStatusEffects=wc(this.playerStatusEffects,"poison")),this.entityRegistry.removeItem(t),!0)}pickupEquipmentAt(t,e){var c;const s=this.entityRegistry.getGroundItems(this.currentLevelId,t,e).find(l=>{if(!fe.isLoaded())return!0;const u=fe.getItem(l.itemId);return u&&u.type!=="consumable"});if(!s)return{};if(fe.isLoaded()){const l=fe.getItem(s.itemId);if(l){const u=this.canEquipItem(l);if(!u.allowed)return{denied:u.reason}}}const r=fe.isLoaded()?bc(fe.getItem(s.itemId).subtype,this):"weapon",o=this.entityRegistry.getEquipped(r);if(o){const l=this.entityRegistry.nextBackpackSlot();if(l===null)return{denied:"Backpack is full"};this.entityRegistry.moveItem(o.instanceId,{kind:"backpack",slot:l})}return this.entityRegistry.moveItem(s.instanceId,{kind:"equipped",slot:r}),{item:{name:fe.isLoaded()?((c=fe.getItem(s.itemId))==null?void 0:c.name)??s.itemId:s.itemId}}}pickupConsumableAt(t,e){var a;const n=this.entityRegistry.nextBackpackSlot();if(n===null)return;const r=this.entityRegistry.getGroundItems(this.currentLevelId,t,e).find(c=>{if(!fe.isLoaded())return!0;const l=fe.getItem(c.itemId);return l&&l.type==="consumable"});return r?(this.entityRegistry.moveItem(r.instanceId,{kind:"backpack",slot:n}),{name:fe.isLoaded()?((a=fe.getItem(r.itemId))==null?void 0:a.name)??r.itemId:r.itemId}):void 0}useConsumable(t){var s,r,o;const e=this.entityRegistry.getBackpackItems();if(t<0||t>=e.length)return!1;const n=e[t];if(fe.isLoaded()){const a=fe.getItem(n.itemId);if(!a||a.type!=="consumable")return!1;a.subtype==="health_potion"?this.hp=Math.min(this.maxHp,this.hp+(a.stats.hp??0)):a.subtype==="torch_oil"&&(this.torchFuel=Math.min(this.maxTorchFuel,this.torchFuel+(((s=a.effect)==null?void 0:s.torchFuel)??0))),(r=a.effect)!=null&&r.restoreHunger&&this.restoreHunger(a.effect.restoreHunger),(o=a.effect)!=null&&o.curePoison&&(this.playerStatusEffects=wc(this.playerStatusEffects,"poison"))}return this.entityRegistry.removeItem(n.instanceId),!0}revealAround(t,e,n,s){const r=s.length,o=s[0].length,a=(d,m)=>{m>=0&&m<r&&d>=0&&d<o&&this.exploredCells.add(X(d,m))};a(t,e),a(t,e-1),a(t,e+1),a(t-1,e),a(t+1,e);const[c,l]=Oe[n];let u=t+c,f=e+l;for(;f>=0&&f<r&&u>=0&&u<o&&(a(u,f),s[f][u]!=="#");)u+=c,f+=l}getPlayerState(){return{hp:this.hp,maxHp:this.maxHp,str:this.str,dex:this.dex,vit:this.vit,wis:this.wis,xp:this.xp,level:this.level,attributePoints:this.attributePoints,playerName:this.playerName,gold:this.gold,torchFuel:this.torchFuel,maxTorchFuel:this.maxTorchFuel,hunger:this.hunger,maxHunger:this.maxHunger,statusEffects:this.playerStatusEffects.map(t=>({...t})),tempBuffs:this.tempBuffs.map(t=>({...t}))}}restorePlayerState(t){this.hp=t.hp,this.maxHp=t.maxHp,this.str=t.str,this.dex=t.dex,this.vit=t.vit,this.wis=t.wis,this.xp=t.xp,this.level=t.level,this.attributePoints=t.attributePoints,this.playerName=t.playerName,this.gold=t.gold,this.torchFuel=t.torchFuel,this.maxTorchFuel=t.maxTorchFuel,this.hunger=t.hunger??100,this.maxHunger=t.maxHunger??100,this.playerStatusEffects=t.statusEffects.map(e=>({...e})),this.tempBuffs=(t.tempBuffs??[]).map(e=>({...e}))}getPickedUpKeys(){return Array.from(this.inventory)}restorePickedUpKeys(t){this.inventory=new Set(t)}}function bc(i,t){if(new Set(["sword","axe","dagger","mace","spear","staff"]).has(i))return"weapon";const n={head:"head",chest:"chest",legs:"legs",hands:"hands",feet:"feet",shield:"shield"};return n[i]?n[i]:i==="ring"?t.entityRegistry.getEquipped("ring1")?"ring2":"ring1":i==="amulet"?"amulet":"weapon"}const I=2,Rt=2.5,y_=Rt*.65,Se=Rt,S_=new ve(I,Rt),Ec=new ve(I,I),Ii=new ve(I,I/2);{const i=Ii.getAttribute("uv");for(let t=0;t<i.count;t++)i.setY(t,i.getY(t)*.5);i.needsUpdate=!0}const Pi=new ve(I/2,I);{const i=Pi.getAttribute("uv");for(let t=0;t<i.count;t++)i.setX(t,i.getX(t)*.5);i.needsUpdate=!0}const Li=new ve(I/2,Rt);{const i=Li.getAttribute("uv");for(let t=0;t<i.count;t++)i.setX(t,i.getX(t)*.5);i.needsUpdate=!0}const Tc=new Map,Ac=new Map,Rc=new Map;function ju(i="stone"){let t=Tc.get(i);return t||(t=new Tt({map:Hr(i)}),Tc.set(i,t)),t}function w_(i="stone_tile"){let t=Ac.get(i);return t||(t=new Tt({map:Is(i)}),Ac.set(i,t)),t}function b_(i="dark_rock"){let t=Rc.get(i);return t||(t=new Tt({map:Ya(i)}),Rc.set(i,t)),t}function E_(i,t,e,n=Wn){return e<0||e>=i.length||t<0||t>=i[0].length?!0:!n.has(i[e][t])}function lr(i,t,e,n,s){if(!s||e<0||e>=i.length||t<0||t>=i[0].length)return n;const r=i[e][t],o=s.get(r);return o&&o.solid&&o.wallTexture?ju(o.wallTexture):n}function T_(i,t,e,n,s=!0,r,o,a,c,l,u,f,d,m,p,_){const g=new Dt,h=new Map,S=new Map,b=i.length,x=i[0].length,P=Er(n),T=zr(n),C=new Set(T);if(n)for(const R of n)R.solid&&R.seeThrough&&C.add(R.char);for(let R=0;R<b;R++)for(let y=0;y<x;y++){if(!C.has(i[R][y])&&!(p!=null&&p.has(X(y,R)))||o!=null&&o.has(X(y,R)))continue;const v=y*I+I/2,A=R*I+I/2,H=i[R][y],L=ri(y,R,H,t,P,e),z=ju(L.wall),$=w_(L.floor),W=b_(L.ceiling),Z=(r==null?void 0:r.has(X(y,R)))??!1,N=a==null?void 0:a.get(X(y,R)),at=As(u,y,R,P,e,"openBottom"),mt=As(l,y,R,P,e,"openTop");let lt=null,ct;const qt=(c==null?void 0:c.has(X(y,R)))??!1;if(qt&&a&&N!==void 0){const w=a.get(X(y,R-1)),M=a.get(X(y,R+1)),D=a.get(X(y+1,R)),K=a.get(X(y-1,R));w!==void 0&&w!==N?(lt="NS",ct=w):M!==void 0&&M!==N?(lt="NS",ct=M):D!==void 0&&D!==N?(lt="EW",ct=D):K!==void 0&&K!==N&&(lt="EW",ct=K)}const Y=f==null?void 0:f.get(X(y,R)),nt=Y==null?void 0:Y.floorKeepHalf;if(!Z&&!at&&!(Y!=null&&Y.skipFloor))if(nt)if(nt==="N"||nt==="S"){const w=new tt(Ii,$);w.rotation.x=-Math.PI/2;const M=nt==="S"?I/4:-I/4;w.position.set(v,0,A+M),N!==void 0&&w.layers.set(N),g.add(w)}else{const w=new tt(Pi,$);w.rotation.x=-Math.PI/2;const M=nt==="E"?I/4:-I/4;w.position.set(v+M,0,A),N!==void 0&&w.layers.set(N),g.add(w)}else if(lt&&ct!==void 0&&N!==void 0)if(lt==="NS"){const w=new tt(Ii,$);w.rotation.x=-Math.PI/2,w.position.set(v,0,A-I/4);const M=new tt(Ii,$);M.rotation.x=-Math.PI/2,M.position.set(v,0,A+I/4);const D=a.get(X(y,R-1));w.layers.set(D!==void 0&&D!==N?D:N),M.layers.set(D!==void 0&&D!==N?N:ct),g.add(w),g.add(M)}else{const w=new tt(Pi,$);w.rotation.x=-Math.PI/2,w.position.set(v-I/4,0,A);const M=new tt(Pi,$);M.rotation.x=-Math.PI/2,M.position.set(v+I/4,0,A);const D=a.get(X(y-1,R));w.layers.set(D!==void 0&&D!==N?D:N),M.layers.set(D!==void 0&&D!==N?N:ct),g.add(w),g.add(M)}else{const w=new tt(Ec,$);w.rotation.x=-Math.PI/2,w.position.set(v,0,A),N!==void 0&&w.layers.set(N),g.add(w),m!=null&&m.has(X(y,R))&&h.set(X(y,R),w)}const St=p==null?void 0:p.get(X(y,R));if(s&&!Z&&!(Y!=null&&Y.skipCeiling)&&!mt&&!(St!=null&&St.skipCeiling))if(lt&&ct!==void 0&&N!==void 0)if(lt==="NS"){const w=new tt(Ii,W);w.rotation.x=Math.PI/2,w.position.set(v,Rt,A-I/4);const M=new tt(Ii,W);M.rotation.x=Math.PI/2,M.position.set(v,Rt,A+I/4);const D=a.get(X(y,R-1));w.layers.set(D!==void 0&&D!==N?D:N),M.layers.set(D!==void 0&&D!==N?N:ct),g.add(w),g.add(M)}else{const w=new tt(Pi,W);w.rotation.x=Math.PI/2,w.position.set(v-I/4,Rt,A);const M=new tt(Pi,W);M.rotation.x=Math.PI/2,M.position.set(v+I/4,Rt,A);const D=a.get(X(y-1,R));w.layers.set(D!==void 0&&D!==N?D:N),M.layers.set(D!==void 0&&D!==N?N:ct),g.add(w),g.add(M)}else{const w=new tt(Ec,W);w.rotation.x=Math.PI/2,w.position.set(v,Rt,A),N!==void 0&&w.layers.set(N),g.add(w),_!=null&&_.has(X(y,R))&&S.set(X(y,R),w)}const ft=(w,M,D,K,Q)=>{if(qt&&lt&&ct!==void 0&&N!==void 0&&Q){if(Q==="along-z"&&lt==="NS"){const dt=a.get(X(y,R-1)),rt=new tt(Li,w);rt.rotation.y=M,rt.position.set(D,Rt/2,K-I/4),rt.layers.set(dt!==void 0&&dt!==N?dt:N),g.add(rt);const pt=new tt(Li,w);pt.rotation.y=M,pt.position.set(D,Rt/2,K+I/4),pt.layers.set(dt!==void 0&&dt!==N?N:ct),g.add(pt);return}if(Q==="along-x"&&lt==="EW"){const dt=a.get(X(y-1,R)),rt=new tt(Li,w);rt.rotation.y=M,rt.position.set(D-I/4,Rt/2,K),rt.layers.set(dt!==void 0&&dt!==N?dt:N),g.add(rt);const pt=new tt(Li,w);pt.rotation.y=M,pt.position.set(D+I/4,Rt/2,K),pt.layers.set(dt!==void 0&&dt!==N?N:ct),g.add(pt);return}}const j=new tt(S_,w);j.rotation.y=M,j.position.set(D,Rt/2,K),N!==void 0&&j.layers.set(N),g.add(j)},Pt=(w,M)=>!s&&(M<0||M>=b||w<0||w>=x)||p!=null&&p.has(X(w,M))?!1:E_(i,w,M,C),Ct=Y==null?void 0:Y.wallDirs,It=Y==null?void 0:Y.keepHalf,te=(w,M,D,K,Q,j)=>{const dt=new tt(Li,w);if(dt.rotation.y=M,j==="along-z"){const rt=Q==="S"?I/4:-I/4;dt.position.set(D,Rt/2,K+rt)}else{const rt=Q==="E"?I/4:-I/4;dt.position.set(D+rt,Rt/2,K)}N!==void 0&&dt.layers.set(N),g.add(dt)},Xt=X(y,R),ge=d==null?void 0:d.get(`${Xt}:N`),O=d==null?void 0:d.get(`${Xt}:S`),Ue=d==null?void 0:d.get(`${Xt}:E`),Yt=d==null?void 0:d.get(`${Xt}:W`),Kt=(o==null?void 0:o.has(X(y,R-1)))??!1;if(!Z&&!Kt&&!(Ct!=null&&Ct.includes("N"))&&Pt(y,R-1)){const w=lr(i,y,R-1,z,P);ge?te(w,0,v,A-I/2,ge,"along-x"):It&&(It==="E"||It==="W")?te(w,0,v,A-I/2,It,"along-x"):ft(w,0,v,A-I/2,"along-x")}const Ut=(o==null?void 0:o.has(X(y,R+1)))??!1;if(!Z&&!Ut&&!(Ct!=null&&Ct.includes("S"))&&Pt(y,R+1)){const w=lr(i,y,R+1,z,P);O?te(w,Math.PI,v,A+I/2,O,"along-x"):It&&(It==="E"||It==="W")?te(w,Math.PI,v,A+I/2,It,"along-x"):ft(w,Math.PI,v,A+I/2,"along-x")}const ce=(o==null?void 0:o.has(X(y+1,R)))??!1;if(!Z&&!ce&&!(Ct!=null&&Ct.includes("E"))&&Pt(y+1,R)){const w=lr(i,y+1,R,z,P);Ue?te(w,-Math.PI/2,v+I/2,A,Ue,"along-z"):It&&(It==="N"||It==="S")?te(w,-Math.PI/2,v+I/2,A,It,"along-z"):ft(w,-Math.PI/2,v+I/2,A,"along-z")}const Lt=(o==null?void 0:o.has(X(y-1,R)))??!1;if(!Z&&!Lt&&!(Ct!=null&&Ct.includes("W"))&&Pt(y-1,R)){const w=lr(i,y-1,R,z,P);Yt?te(w,Math.PI/2,v-I/2,A,Yt,"along-z"):It&&(It==="N"||It==="S")?te(w,Math.PI/2,v-I/2,A,It,"along-z"):ft(w,Math.PI/2,v-I/2,A,"along-z")}}return{group:g,pitFloorMap:h,pitCeilingMap:S}}const A_=["stone","brick","mossy","wood","forest"],R_=["stone_tile","dirt","cobblestone","grass"],C_=["dark_rock","wooden_beams","canopy"],I_=new Set(A_),P_=new Set(R_),L_=new Set(C_),Rs=["N","E","S","W"];function Cc(i){const t=[];for(const e of i.layers)t.push(...e.entities);return t}function D_(i,t){const e=String(t),n=i.layers.findIndex(s=>s.id===e);return n>=0?n:0}function U_(i,t){for(let e=0;e<i.layers.length;e++)if(i.layers[e].entities.some(n=>n.id===t))return e;return 0}const Ic=new Set([".","#"," "]);function ws(i,t,e){if(i.wallTexture!==void 0&&!I_.has(i.wallTexture))throw new Error(`Level ${e}: ${t} has unknown wallTexture "${i.wallTexture}"`);if(i.floorTexture!==void 0&&!P_.has(i.floorTexture))throw new Error(`Level ${e}: ${t} has unknown floorTexture "${i.floorTexture}"`);if(i.ceilingTexture!==void 0&&!L_.has(i.ceilingTexture))throw new Error(`Level ${e}: ${t} has unknown ceilingTexture "${i.ceilingTexture}"`)}function Pc(i){const t=new Set;for(const r of i)r.id&&t.add(r.id);const e={};function n(r){for(e[r]||(e[r]=1);t.has(`${r}_${e[r]}`);)e[r]++;const o=`${r}_${e[r]}`;return t.add(o),e[r]++,o}for(const r of i)r.type==="door"&&!r.id&&(r.id=n("door"));const s=new Map;for(const r of i)r.type==="door"&&r.id&&s.set(`${r.col},${r.row}`,r.id);for(const r of i)if(r.type==="lever"||r.type==="pressure_plate"){if(r.targetDoor&&!r.target){const o=s.get(r.targetDoor);o&&(r.target=o,delete r.targetDoor)}r.target&&!r.targets&&(r.targets=[r.target],delete r.target,delete r.targetDoor)}}function Zu(i,t,e,n,s,r,o,a,c){const l=`Level ${o}: entities[${t}]`;if(i.row<0||i.row>=e.length||i.col<0||i.col>=n)return`${l} (${i.col},${i.row}) is out of grid bounds`;const u=e[i.row][i.col],f=p=>{if(!Array.isArray(i.targets))return`${l} ${p} must have a targets array`;for(const _ of i.targets){if(typeof _!="string"||_==="")return`${l} ${p} targets must contain non-empty strings`;if(!r.has(_))return`${l} ${p} target "${_}" must reference an existing entity id`}return null},d=p=>i.signalMode!==void 0&&!a.has(i.signalMode)?`${l} ${p} signalMode must be one of ${[...a].join(", ")}`:i.signalDuration!==void 0&&typeof i.signalDuration!="number"?`${l} ${p} signalDuration must be a number`:i.signalDelay!==void 0&&typeof i.signalDelay!="number"?`${l} ${p} signalDelay must be a number`:null,m=p=>s.has(u)?null:`${l} ${p} must be on a walkable cell, found '${u}'`;switch(i.type){case"door":{const p=m("door");if(p)return p;const _=new Set(["open","closed"]);if(i.state!==void 0&&!_.has(i.state))return`${l} door state must be open or closed`;if(i.keyId!==void 0&&typeof i.keyId!="string")return`${l} door keyId must be a string`;const g=["or","and","xor"];if(i.gateMode!==void 0&&!g.includes(i.gateMode))return`${l} door gateMode must be one of ${g.join(", ")}`;break}case"key":{if(typeof i.keyId!="string")return`${l} key must have a string keyId`;const p=m("key");if(p)return p;break}case"lever":{const p=f("lever");if(p)return p;if(i.wall!==void 0&&!["N","S","E","W"].includes(i.wall))return`${l} lever wall must be N, S, E, or W`;const _=d("lever");if(_)return _;break}case"pressure_plate":{const p=f("pressure_plate");if(p)return p;const _=m("pressure_plate");if(_)return _;const g=d("pressure_plate");if(g)return g;break}case"trigger":{const p=f("trigger");if(p)return p;const _=m("trigger");if(_)return _;const g=d("trigger");if(g)return g;break}case"tripwire":{const p=f("tripwire");if(p)return p;const _=m("tripwire");if(_)return _;if(i.visibilityThreshold!==void 0&&typeof i.visibilityThreshold!="number")return`${l} tripwire visibilityThreshold must be a number`;if(i.orientation!==void 0&&i.orientation!=="EW"&&i.orientation!=="NS")return`${l} tripwire orientation must be "EW" or "NS"`;break}case"gate":{const p=f("gate");if(p)return p;if(!c.has(i.gateType))return`${l} gate must have a valid gateType (${[...c].join(", ")})`;if(i.delay!==void 0&&typeof i.delay!="number")return`${l} gate delay must be a number`;if(i.interval!==void 0&&typeof i.interval!="number")return`${l} gate interval must be a number`;break}case"trap_launcher":{const p=m("trap_launcher");if(p)return p;if(typeof i.facing!="string"||!["N","S","E","W"].includes(i.facing))return`${l} trap_launcher must have facing "N", "S", "E", or "W"`;if(typeof i.projectileType!="string"||!["dart","arrow","fireball"].includes(i.projectileType))return`${l} trap_launcher must have projectileType "dart", "arrow", or "fireball"`;if(typeof i.reloadTime!="number"||i.reloadTime<=0)return`${l} trap_launcher must have a positive number reloadTime`;if(i.maxRange!==void 0&&typeof i.maxRange!="number")return`${l} trap_launcher maxRange must be a number`;break}case"enemy":{if(typeof i.enemyType!="string")return`${l} enemy must have a string enemyType`;if(!Pn.getEnemy(i.enemyType))return`${l} enemy has unknown enemyType "${i.enemyType}"`;const p=m("enemy");if(p)return p;break}case"torch_sconce":{const p=m("torch_sconce");if(p)return p;if(i.wall!==void 0&&!["N","S","E","W"].includes(i.wall))return`${l} torch_sconce wall must be N, S, E, or W`;break}case"equipment":{if(typeof i.itemId!="string")return`${l} equipment must have a string itemId`;const p=m("equipment");if(p)return p;break}case"consumable":{if(typeof i.itemId!="string")return`${l} consumable must have a string itemId`;const p=m("consumable");if(p)return p;break}case"stairs":{if(i.direction!=="up"&&i.direction!=="down")return`${l} stairs must have direction "up" or "down"`;if(typeof i.facing!="string"||!Rs.includes(i.facing))return`${l} stairs must have facing "N", "S", "E", or "W"`;const p=m("stairs");if(p)return p;if(typeof i.target!="string")return`${l} stairs must have a string target (paired stair entity ID)`;break}case"breakable_wall":{if(s.has(u))return`${l} breakable_wall must be on a solid cell, found '${u}'`;if(typeof i.hp!="number"||i.hp<=0)return`${l} breakable_wall must have a positive hp`;break}case"secret_wall":{if(s.has(u))return`${l} secret_wall must be on a solid cell, found '${u}'`;break}case"block":{const p=m("block");if(p)return p;break}case"chest":{const p=m("chest");if(p)return p;if(i.state!==void 0&&!new Set(["closed","open","locked"]).has(i.state))return`${l} chest state must be closed, open, or locked`;if(i.facing!==void 0&&!["N","S","E","W"].includes(i.facing))return`${l} chest facing must be N, S, E, or W`;if(i.keyId!==void 0&&typeof i.keyId!="string")return`${l} chest keyId must be a string`;if(i.gateMode!==void 0){const _=["or","and","xor"];if(!_.includes(i.gateMode))return`${l} chest gateMode must be one of ${_.join(", ")}`}if(i.targets!==void 0){const _=f("chest");if(_)return _}break}case"sign":{const p=m("sign");if(p)return p;if(i.wall!==void 0&&!["N","S","E","W"].includes(i.wall))return`${l} sign wall must be N, S, E, or W`;if(typeof i.text!="string"||i.text.length===0)return`${l} sign must have non-empty text`;break}case"npc":{if(typeof i.npcId!="string")return`${l} npc must have a string npcId`;if(Zi.isLoaded()&&!Zi.getNpc(i.npcId))return`${l} npc has unknown npcId "${i.npcId}"`;const p=m("npc");if(p)return p;break}case"fountain":{const p=m("fountain");if(p)return p;if(i.healAmount!==void 0&&(typeof i.healAmount!="number"||i.healAmount<=0))return`${l} fountain healAmount must be a positive number`;break}case"bookshelf":{const p=m("bookshelf");if(p)return p;if(i.wall!==void 0&&!["N","S","E","W"].includes(i.wall))return`${l} bookshelf wall must be N, S, E, or W`;if(i.text!==void 0&&typeof i.text!="string")return`${l} bookshelf text must be a string`;break}case"altar":{const p=m("altar");if(p)return p;const _=["atk","def","str","dex","vit","wis"];if(i.buffType!==void 0&&!_.includes(i.buffType))return`${l} altar buffType must be one of ${_.join(", ")}`;if(i.buffAmount!==void 0&&(typeof i.buffAmount!="number"||i.buffAmount<=0))return`${l} altar buffAmount must be a positive number`;if(i.buffDuration!==void 0&&(typeof i.buffDuration!="number"||i.buffDuration<=0))return`${l} altar buffDuration must be a positive number`;break}case"barrel":{const p=m("barrel");if(p)return p;if(i.hp!==void 0&&(typeof i.hp!="number"||i.hp<=0))return`${l} barrel hp must be a positive number`;break}case"thin_wall":{const p=m("thin_wall");if(p)return p;if(i.wall!=="S"&&i.wall!=="E")return`${l} thin_wall wall must be 'S' or 'E', got '${i.wall}'`;if(i.height!==void 0&&i.height!=="full"&&i.height!=="half")return`${l} thin_wall height must be 'full' or 'half', got '${i.height}'`;if(i.solid!==void 0&&typeof i.solid!="boolean")return`${l} thin_wall solid must be boolean`;break}case"ramp":{const p=m("ramp");if(p)return p;if(i.facing!==void 0&&!["N","S","E","W"].includes(i.facing))return`${l} ramp facing must be N, S, E, or W`;if(i.style!==void 0&&i.style!=="ramp"&&i.style!=="stairs")return`${l} ramp style must be 'ramp' or 'stairs'`;break}case"prop":{const p=m("prop");if(p)return p;const _=["pillar","rubble","stalactite","stalagmite","statue","crate_stack","banner"];if(!i.propId||!_.includes(i.propId))return`${l} prop must have a valid propId (${_.join(", ")})`;if(i.propId==="banner"&&i.wall!==void 0&&!["N","S","E","W"].includes(i.wall))return`${l} banner wall must be N, S, E, or W`;if(i.rotation!==void 0&&(typeof i.rotation!="number"||![0,1,2,3].includes(i.rotation)))return`${l} prop rotation must be 0, 1, 2, or 3`;break}case"pit_trap":{const p=m("pit_trap");if(p)return p;if(i.state!==void 0&&!["closed","open"].includes(i.state))return`${l} pit_trap state must be 'closed' or 'open'`;if(i.gateMode!==void 0&&!["or","and","xor"].includes(i.gateMode))return`${l} pit_trap gateMode must be 'or', 'and', or 'xor'`;break}case"spawner":{const p=m("spawner");if(p)return p;if(i.enemyType!==void 0&&typeof i.enemyType!="string")return`${l} spawner enemyType must be a string`;if(i.maxActive!==void 0&&(typeof i.maxActive!="number"||i.maxActive<1))return`${l} spawner maxActive must be a positive number`;if(i.interval!==void 0&&(typeof i.interval!="number"||i.interval<=0))return`${l} spawner interval must be a positive number`;if(i.spawnRadius!==void 0&&(typeof i.spawnRadius!="number"||i.spawnRadius<1))return`${l} spawner spawnRadius must be >= 1`;if(i.gateMode!==void 0&&!["or","and","xor"].includes(i.gateMode))return`${l} spawner gateMode must be 'or', 'and', or 'xor'`;if(i.visible!==void 0&&typeof i.visible!="boolean")return`${l} spawner visible must be a boolean`;break}case"boulder":{const p=m("boulder");if(p)return p;if(i.direction!==void 0&&!["N","S","E","W"].includes(i.direction))return`${l} boulder direction must be 'N', 'S', 'E', or 'W'`;if(i.state!==void 0&&!["idle","rolling","falling"].includes(i.state))return`${l} boulder state must be 'idle', 'rolling', or 'falling'`;if(i.rollDamage!==void 0&&(typeof i.rollDamage!="number"||i.rollDamage<0))return`${l} boulder rollDamage must be >= 0`;if(i.fallDamage!==void 0&&(typeof i.fallDamage!="number"||i.fallDamage<0))return`${l} boulder fallDamage must be >= 0`;if(i.instaKillEnemies!==void 0&&typeof i.instaKillEnemies!="boolean")return`${l} boulder instaKillEnemies must be a boolean`;if(i.pushable!==void 0&&typeof i.pushable!="boolean")return`${l} boulder pushable must be a boolean`;if(i.gateMode!==void 0&&!["or","and","xor"].includes(i.gateMode))return`${l} boulder gateMode must be 'or', 'and', or 'xor'`;break}case"boulder_spawner":{if(i.direction!==void 0&&!["N","S","E","W"].includes(i.direction))return`${l} boulder_spawner direction must be 'N', 'S', 'E', or 'W'`;if(i.intervalMode!==void 0&&!["fixed","random"].includes(i.intervalMode))return`${l} boulder_spawner intervalMode must be 'fixed' or 'random'`;if(i.interval!==void 0&&(typeof i.interval!="number"||i.interval<=0))return`${l} boulder_spawner interval must be a positive number`;if(i.intervalMin!==void 0&&(typeof i.intervalMin!="number"||i.intervalMin<=0))return`${l} boulder_spawner intervalMin must be a positive number`;if(i.intervalMax!==void 0&&(typeof i.intervalMax!="number"||i.intervalMax<=0))return`${l} boulder_spawner intervalMax must be a positive number`;if(i.intervalMin!==void 0&&i.intervalMax!==void 0&&i.intervalMax<i.intervalMin)return`${l} boulder_spawner intervalMax must be >= intervalMin`;if(i.rollDamage!==void 0&&(typeof i.rollDamage!="number"||i.rollDamage<0))return`${l} boulder_spawner rollDamage must be >= 0`;if(i.fallDamage!==void 0&&(typeof i.fallDamage!="number"||i.fallDamage<0))return`${l} boulder_spawner fallDamage must be >= 0`;if(i.instaKillEnemies!==void 0&&typeof i.instaKillEnemies!="boolean")return`${l} boulder_spawner instaKillEnemies must be a boolean`;if(i.pushable!==void 0&&typeof i.pushable!="boolean")return`${l} boulder_spawner pushable must be a boolean`;if(i.gateMode!==void 0&&!["or","and","xor"].includes(i.gateMode))return`${l} boulder_spawner gateMode must be 'or', 'and', or 'xor'`;break}}return null}function N_(i,t,e,n,s,r){const o=`Level ${e} layers[${t}]`;if(!Array.isArray(i.grid)||i.grid.length===0||!i.grid.every(m=>typeof m=="string"))throw new Error(`${o}: "grid" must be a non-empty array of strings`);const a=i.grid,c=a[0].length;if(!a.every(m=>m.length===c))throw new Error(`${o}: all grid rows must be the same length`);for(const m of a)for(const p of m)if(!s.has(p))throw new Error(`${o}: unknown cell character '${p}'`);if(!Array.isArray(i.entities))throw new Error(`${o}: "entities" must be an array`);const l=[],u=new Set(["toggle","momentary","one_shot","timed"]),f=new Set(["and","or","not","delay","pulse_edge","pulse_repeat"]);for(let m=0;m<i.entities.length;m++){const p=i.entities[m];if(typeof p!="object"||p===null||Array.isArray(p))throw new Error(`${o}: entities[${m}] must be an object`);if(typeof p.col!="number"||typeof p.row!="number")throw new Error(`${o}: entities[${m}] must have numeric col and row`);if(typeof p.type!="string")throw new Error(`${o}: entities[${m}] must have a string type`);const _=Zu(p,m,a,c,r,n,`${e} layers[${t}]`,u,f);if(_){console.warn(`${_} — entity skipped`);continue}l.push(p)}if(i.entities=l,i.defaults!==void 0){if(typeof i.defaults!="object"||i.defaults===null||Array.isArray(i.defaults))throw new Error(`${o}: "defaults" must be an object`);ws(i.defaults,"defaults",`${e} layers[${t}]`)}const d=["dungeon","mist","forest","outdoor"];if(i.areas!==void 0){if(!Array.isArray(i.areas))throw new Error(`${o}: "areas" must be an array`);for(let m=0;m<i.areas.length;m++){const p=i.areas[m];if(typeof p!="object"||p===null||Array.isArray(p))throw new Error(`${o}: areas[${m}] must be an object`);const _=p;if(typeof _.fromCol!="number"||typeof _.toCol!="number"||typeof _.fromRow!="number"||typeof _.toRow!="number")throw new Error(`${o}: areas[${m}] must have numeric fromCol, toCol, fromRow, toRow`);if(_.fromCol>_.toCol||_.fromRow>_.toRow)throw new Error(`${o}: areas[${m}] has fromCol > toCol or fromRow > toRow`);if(_.fromCol<0||_.toCol>=c||_.fromRow<0||_.toRow>=a.length)throw new Error(`${o}: areas[${m}] is out of grid bounds`);if(_.environment!==void 0&&!d.includes(_.environment))throw new Error(`${o}: areas[${m}].environment must be one of ${d.join(", ")}`);if(_.openBottom!==void 0&&typeof _.openBottom!="boolean")throw new Error(`${o}: areas[${m}].openBottom must be a boolean`);if(_.openTop!==void 0&&typeof _.openTop!="boolean")throw new Error(`${o}: areas[${m}].openTop must be a boolean`);if(_.wallTexture===void 0&&_.floorTexture===void 0&&_.ceilingTexture===void 0&&_.environment===void 0&&!_.openBottom&&!_.openTop)throw new Error(`${o}: areas[${m}] must specify at least one texture, an environment, or a hollow flag`);ws(_,`areas[${m}]`,`${e} layers[${t}]`)}}if(i.ceiling!==void 0&&typeof i.ceiling!="boolean")throw new Error(`${o}: "ceiling" must be a boolean`);if(i.yOffset!==void 0&&typeof i.yOffset!="number")throw new Error(`${o}: "yOffset" must be a number`);return i}function F_(i,t){if(typeof i!="object"||i===null)throw new Error(`Level data from ${t} is not an object`);const e=i;if(typeof e.name!="string")throw new Error(`Level ${t}: "name" must be a string`);const n=new Set,s=new Set(Wn);if(e.charDefs!==void 0){if(!Array.isArray(e.charDefs))throw new Error(`Level ${t}: "charDefs" must be an array`);for(let _=0;_<e.charDefs.length;_++){const g=e.charDefs[_];if(typeof g!="object"||g===null||Array.isArray(g))throw new Error(`Level ${t}: charDefs[${_}] must be an object`);const h=g;if(typeof h.char!="string"||h.char.length!==1)throw new Error(`Level ${t}: charDefs[${_}].char must be a single character`);if(Ic.has(h.char))throw new Error(`Level ${t}: charDefs[${_}].char '${h.char}' conflicts with built-in character`);if(n.has(h.char))throw new Error(`Level ${t}: charDefs[${_}].char '${h.char}' is a duplicate`);if(n.add(h.char),typeof h.solid!="boolean")throw new Error(`Level ${t}: charDefs[${_}].solid must be a boolean`);if(h.solid||s.add(h.char),h.seeThrough!==void 0){if(typeof h.seeThrough!="boolean")throw new Error(`Level ${t}: charDefs[${_}].seeThrough must be a boolean`);if(h.seeThrough&&!h.solid)throw new Error(`Level ${t}: charDefs[${_}].seeThrough requires solid to be true`)}ws(h,`charDefs[${_}]`,t)}}const r=new Set(Ic);for(const _ of n)r.add(_);if(!Array.isArray(e.layers)||e.layers.length===0)throw new Error(`Level ${t}: "layers" must be a non-empty array`);const o=new Set;for(let _=0;_<e.layers.length;_++){const g=e.layers[_];if(typeof g!="object"||g===null||Array.isArray(g))throw new Error(`Level ${t}: layers[${_}] must be an object`);const h=g;if(!Array.isArray(h.entities))throw new Error(`Level ${t} layers[${_}]: "entities" must be an array`);Pc(h.entities);for(const S of h.entities)if(S.id){if(o.has(S.id))throw new Error(`Level ${t} layers[${_}]: duplicate entity id "${S.id}"`);o.add(S.id)}}const a=[];for(let _=0;_<e.layers.length;_++)a.push(N_(e.layers[_],_,t,o,r,s));e.layers=a,e.grid=a[0].grid,e.entities=a[0].entities;const c=e.grid,l=c[0].length;if(e.playerStart!==void 0){const _=e.playerStart;if(typeof _!="object"||_===null)throw new Error(`Level ${t}: "playerStart" must be an object`);const g=_;if(typeof g.col!="number"||typeof g.row!="number")throw new Error(`Level ${t}: "playerStart" must have numeric col and row`);if(!Rs.includes(g.facing))throw new Error(`Level ${t}: "playerStart.facing" must be one of ${Rs.join(", ")}`);const h=g.col,S=g.row;if(S<0||S>=c.length||h<0||h>=l)throw new Error(`Level ${t}: playerStart (${h},${S}) is out of grid bounds`);s.has(c[S][h])||console.warn(`Level ${t}: playerStart (${h},${S}) is not a walkable tile`)}if(!Array.isArray(e.entities))throw new Error(`Level ${t}: "entities" must be an array`);Pc(e.entities);const u=new Set;for(const _ of e.entities)if(_.id){if(u.has(_.id))throw new Error(`Level ${t}: duplicate entity id "${_.id}"`);u.add(_.id)}const f=[],d=new Set(["toggle","momentary","one_shot","timed"]),m=new Set(["and","or","not","delay","pulse_edge","pulse_repeat"]);for(let _=0;_<e.entities.length;_++){const g=e.entities[_];if(typeof g!="object"||g===null||Array.isArray(g))throw new Error(`Level ${t}: entities[${_}] must be an object`);if(typeof g.col!="number"||typeof g.row!="number")throw new Error(`Level ${t}: entities[${_}] must have numeric col and row`);if(typeof g.type!="string")throw new Error(`Level ${t}: entities[${_}] must have a string type`);const h=Zu(g,_,c,l,s,u,t,d,m);if(h){console.warn(`${h} — entity skipped`);continue}f.push(g)}e.entities=f;const p=["dungeon","mist","forest","outdoor"];if(e.environment!==void 0&&!p.includes(e.environment))throw new Error(`Level ${t}: "environment" must be one of ${p.join(", ")}`);if(e.skybox!==void 0){const _=["starry-night","daylight","sunset"];if(!_.includes(e.skybox))throw new Error(`Level ${t}: "skybox" must be one of ${_.join(", ")}`);e.ceiling!==!1&&console.warn(`Level ${t}: "skybox" is set but "ceiling" is not false — skybox won't be visible`)}if(e.defaults!==void 0){if(typeof e.defaults!="object"||e.defaults===null||Array.isArray(e.defaults))throw new Error(`Level ${t}: "defaults" must be an object`);ws(e.defaults,"defaults",t)}if(e.areas!==void 0){if(!Array.isArray(e.areas))throw new Error(`Level ${t}: "areas" must be an array`);for(let _=0;_<e.areas.length;_++){const g=e.areas[_];if(typeof g!="object"||g===null||Array.isArray(g))throw new Error(`Level ${t}: areas[${_}] must be an object`);const h=g;if(typeof h.fromCol!="number"||typeof h.toCol!="number"||typeof h.fromRow!="number"||typeof h.toRow!="number")throw new Error(`Level ${t}: areas[${_}] must have numeric fromCol, toCol, fromRow, toRow`);if(h.fromCol>h.toCol||h.fromRow>h.toRow)throw new Error(`Level ${t}: areas[${_}] has fromCol > toCol or fromRow > toRow`);const S=c.length;if(h.fromCol<0||h.toCol>=l||h.fromRow<0||h.toRow>=S)throw new Error(`Level ${t}: areas[${_}] is out of grid bounds`);if(h.environment!==void 0&&!p.includes(h.environment))throw new Error(`Level ${t}: areas[${_}].environment must be one of ${p.join(", ")}`);if(h.openBottom!==void 0&&typeof h.openBottom!="boolean")throw new Error(`Level ${t}: areas[${_}].openBottom must be a boolean`);if(h.openTop!==void 0&&typeof h.openTop!="boolean")throw new Error(`Level ${t}: areas[${_}].openTop must be a boolean`);if(h.wallTexture===void 0&&h.floorTexture===void 0&&h.ceilingTexture===void 0&&h.environment===void 0&&!h.openBottom&&!h.openTop)throw new Error(`Level ${t}: areas[${_}] must specify at least one texture, an environment, or a hollow flag`);ws(h,`areas[${_}]`,t)}}return i}function O_(i,t){var o,a,c,l;if(typeof i!="object"||i===null)throw new Error(`Dungeon data from ${t} is not an object`);const e=i;if(typeof e.name!="string")throw new Error(`Dungeon ${t}: "name" must be a string`);if(!Array.isArray(e.levels)||e.levels.length===0)throw new Error(`Dungeon ${t}: "levels" must be a non-empty array`);const n=new Set,s=[];for(let u=0;u<e.levels.length;u++){const f=F_(e.levels[u],`${t} levels[${u}]`);if(typeof f.id!="string"||f.id.length===0)throw new Error(`Dungeon ${t}: levels[${u}] must have a non-empty string "id"`);if(n.has(f.id))throw new Error(`Dungeon ${t}: duplicate level id "${f.id}"`);n.add(f.id),s.push(f)}let r;if(e.playerStart!==void 0){const u=e.playerStart;if(typeof u!="object"||u===null)throw new Error(`Dungeon ${t}: "playerStart" must be an object`);if(typeof u.levelId!="string"||u.levelId==="")throw new Error(`Dungeon ${t}: "playerStart.levelId" must be a non-empty string`);if(!n.has(u.levelId))throw new Error(`Dungeon ${t}: "playerStart.levelId" "${u.levelId}" does not match any level id`);if(typeof u.col!="number"||typeof u.row!="number")throw new Error(`Dungeon ${t}: "playerStart" must have numeric col and row`);if(!Rs.includes(u.facing))throw new Error(`Dungeon ${t}: "playerStart.facing" must be one of ${Rs.join(", ")}`);const f=s.find(b=>b.id===u.levelId),d=u.col,m=u.row,p=typeof u.layerIndex=="number"?u.layerIndex:0,_=D_(f,p),g=((a=(o=f.layers)==null?void 0:o[_])==null?void 0:a.grid)??f.grid,h=g[0].length;if(m<0||m>=g.length||d<0||d>=h)throw new Error(`Dungeon ${t}: playerStart (${d},${m}) is out of grid bounds on level "${u.levelId}" layer ${p}`);const S=new Set(Wn);if(f.charDefs)for(const b of f.charDefs)b.solid||S.add(b.char);S.has(g[m][d])||console.warn(`Dungeon ${t}: playerStart (${d},${m}) is on a non-walkable tile on level "${u.levelId}" layer ${p}`),r={levelId:u.levelId,col:d,row:m,facing:u.facing,layerIndex:p!==0?p:void 0}}else{const u=s.find(f=>f.playerStart!==void 0);if(!u||!u.playerStart)throw new Error(`Dungeon ${t}: "playerStart" is required on the dungeon object`);r={levelId:u.id,col:u.playerStart.col,row:u.playerStart.row,facing:u.playerStart.facing}}for(let u=0;u<s.length;u++){const f=s[u],d=Cc(f);for(let m=0;m<d.length;m++){const p=d[m];if(p.type==="stairs"){const _=p.target;let g,h,S=0;for(const v of s)if(g=Cc(v).find(A=>A.id===_),g){h=v,S=U_(v,_);break}if(!g||!h){console.warn(`Dungeon ${t}: levels[${u}] stairs "${p.id}" target "${_}" does not match any stair entity in the dungeon — stair will not function`);continue}if(g.type!=="stairs"){console.warn(`Dungeon ${t}: levels[${u}] stairs "${p.id}" target "${_}" is not a stairs entity — stair will not function`);continue}const b=((l=(c=h.layers)==null?void 0:c[S])==null?void 0:l.grid)??h.grid,x={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]},[P,T]=x[g.facing]??[0,0],C=g.col+P,R=g.row+T;if(R<0||R>=b.length||C<0||C>=b[0].length){console.warn(`Dungeon ${t}: levels[${u}] stairs "${p.id}" spawn position (${C},${R}) is out of bounds on level "${h.id}" — stair will not function`);continue}const y=new Set(Wn);if(h.charDefs)for(const v of h.charDefs)v.solid||y.add(v.char);y.has(b[R][C])||console.warn(`Dungeon ${t}: levels[${u}] stairs "${p.id}" spawn position (${C},${R}) is not walkable on level "${h.id}" layer ${S} — stair will not function`)}}}return{name:e.name,levels:s,playerStart:r}}async function rM(i){const t=await fetch(i);if(!t.ok)throw new Error(`Failed to load dungeon from ${i}: ${t.status} ${t.statusText}`);const e=await t.json();return O_(e,i)}const Di=.15,ye=.15;function cr(i,t,e,n,s){const r=i.getAttribute("uv"),o=t/s,a=e/s,c=n/s;for(const l of[0,4])for(let u=0;u<4;u++)r.setX(l+u,r.getX(l+u)*c),r.setY(l+u,r.getY(l+u)*a);for(const l of[8,12])for(let u=0;u<4;u++)r.setX(l+u,r.getX(l+u)*o),r.setY(l+u,r.getY(l+u)*c);for(const l of[16,20])for(let u=0;u<4;u++)r.setX(l+u,r.getX(l+u)*o),r.setY(l+u,r.getY(l+u)*a);r.needsUpdate=!0}function B_(i,t,e,n){const s=i.length,r=i[0].length,o=e-1<0||!n.has(i[e-1][t]),a=e+1>=s||!n.has(i[e+1][t]),c=t+1>=r||!n.has(i[e][t+1]),l=t-1<0||!n.has(i[e][t-1]);return c&&l?"EW":"NS"}const Lc=.06,Dc=.03,Uc=1.1;function k_(i,t){const e=new jt(Lc,Lc,Dc),n=new tt(e,t);n.position.set(-1.7/2-ye/2,Uc,Di/2+Dc/2),i.add(n);const s=new tt(e,t);s.position.set(-1.7/2-ye/2,Uc,-.09),i.add(s)}function z_(i,t,e,n,s){const r=new Dt,o=I-ye*2,a=Di/2;if(s){const c=new jt(ye,Rt,a);cr(c,ye,Rt,a,I);const l=new jt(I,ye,a);cr(l,I,ye,a,I);const u=[-o/2-ye/2,o/2+ye/2];for(const m of u){const p=new tt(c,n);p.position.set(m,Rt/2,-a/2),p.layers.set(s[0]),r.add(p);const _=new tt(c,n);_.position.set(m,Rt/2,a/2),_.layers.set(s[1]),r.add(_)}const f=new tt(l,n);f.position.set(0,Rt-ye/2,-a/2),f.layers.set(s[0]),r.add(f);const d=new tt(l,n);d.position.set(0,Rt-ye/2,a/2),d.layers.set(s[1]),r.add(d)}else{const c=new jt(ye,Rt,Di);cr(c,ye,Rt,Di,I);const l=new tt(c,n);l.position.set(-o/2-ye/2,Rt/2,0),r.add(l);const u=new tt(c,n);u.position.set(o/2+ye/2,Rt/2,0),r.add(u);const f=new jt(I,ye,Di);cr(f,I,ye,Di,I);const d=new tt(f,n);d.position.set(0,Rt-ye/2,0),r.add(d)}return r.position.set(t,0,e),i==="NS"&&(r.rotation.y=Math.PI/2),r}function H_(i,t,e,n){const s=new Dt,r=new Map,o=new Map,a=new Map,c=I-ye*2,l=Rt-ye,u=.08,f=new jt(c,l,u);{const h=f.getAttribute("uv"),S=u/I,b=l/I,x=c/I;for(const P of[0,4])for(let T=0;T<4;T++)h.setX(P+T,h.getX(P+T)*S),h.setY(P+T,h.getY(P+T)*b);for(const P of[8,12])for(let T=0;T<4;T++)h.setX(P+T,h.getX(P+T)*x),h.setY(P+T,h.getY(P+T)*S);h.needsUpdate=!0}const d=new Tt({map:l_(),side:Pe}),m=new Tt({map:c_(),side:Pe}),p=u_();p.wrapS=Ye,p.wrapT=Ye;const _=new Tt({map:p}),g=new Tt({color:13404211});for(const[h,S]of t.doors){const{col:b,row:x}=S,P=b*I+I/2,T=x*I+I/2,C=B_(i,b,x,e);let R;const y=n==null?void 0:n.get(X(b,x));if(n&&y!==void 0){let L,z;C==="EW"?(L=X(b,x-1),z=X(b,x+1)):(L=X(b-1,x),z=X(b+1,x));const $=n.get(L),W=n.get(z);$!==void 0&&W!==void 0&&$!==W&&(R=[$,W])}const v=z_(C,P,T,_,R);if(!S.mechanical){const L=v.children.length;if(k_(v,g),R)for(let z=L;z<v.children.length;z++){const $=v.children[z];$.position.z<0?$.layers.set(R[0]):$.layers.set(R[1])}}!R&&y!==void 0&&v.traverse(L=>{L.layers.set(y)}),s.add(v);const A=S.keyId?m:d;let H;if(R){const L=new jt(c,l,u/2);{const Z=L.getAttribute("uv"),N=u/2/I,at=l/I,mt=c/I;for(const lt of[0,4])for(let ct=0;ct<4;ct++)Z.setX(lt+ct,Z.getX(lt+ct)*N),Z.setY(lt+ct,Z.getY(lt+ct)*at);for(const lt of[8,12])for(let ct=0;ct<4;ct++)Z.setX(lt+ct,Z.getX(lt+ct)*mt),Z.setY(lt+ct,Z.getY(lt+ct)*N);Z.needsUpdate=!0}const z=new Dt,$=new tt(L,A);$.position.set(0,0,-u/4),$.layers.set(R[0]),z.add($);const W=new tt(L,A);W.position.set(0,0,u/4),W.layers.set(R[1]),z.add(W),z.position.set(P,l/2,T),C==="NS"&&(z.rotation.y=Math.PI/2),z.visible=S.state!=="open",H=z}else{const L=new tt(f,A);L.position.set(P,l/2,T),C==="NS"&&(L.rotation.y=Math.PI/2),L.visible=S.state!=="open",y!==void 0&&L.layers.set(y),H=L}if(s.add(H),r.set(h,H),o.set(h,C),R){const L=Math.max(R[0],R[1]),z=new Xu(16772829,3,10,2);z.position.set(P,Rt*.7,T),z.layers.set(L),z.visible=S.state==="open",s.add(z),a.set(h,z)}}return{group:s,panelMap:r,orientationMap:o,boundaryLights:a}}function oM(i,t,e,n,s){if(n)n.setOpen(t,e);else{const r=i.get(t);r&&(r.visible=!e)}}function ss(i){return new Cn({uniforms:Nu.merge([ht.lights,ht.fog,{map:{value:i},tint:{value:new kt(16777215)}}]),vertexShader:`
      varying vec2 vUv;
      varying vec3 vViewCenter;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        // Compute world matrix — includes instanceMatrix for InstancedMesh
        #ifdef USE_INSTANCING
          mat4 worldMatrix = modelMatrix * instanceMatrix;
        #else
          mat4 worldMatrix = modelMatrix;
        #endif
        // Object center in VIEW space (same space as Three.js light positions)
        vViewCenter = (viewMatrix * vec4(worldMatrix[3].xyz, 1.0)).xyz;
        vec4 mvPosition = viewMatrix * worldMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,fragmentShader:`
      uniform sampler2D map;
      uniform vec3 tint;
      varying vec2 vUv;
      varying vec3 vViewCenter;

      // Three.js injects these structs with lights: true
      #include <common>
      #include <lights_pars_begin>
      #include <fog_pars_fragment>

      void main() {
        vec4 texColor = texture2D(map, vUv);
        if (texColor.a < 0.5) discard;

        // Accumulate light intensity (luminance only, no color).
        // Billboard uses object center for lighting — no NdotL, no per-vertex variation.
        float intensity = 0.0;

        // Point lights — positions are in view space, matching vViewCenter
        #if NUM_POINT_LIGHTS > 0
        for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
          float dist = length(vViewCenter - pointLights[i].position);
          float atten = getDistanceAttenuation(dist, pointLights[i].distance, pointLights[i].decay);
          float lum = dot(pointLights[i].color, vec3(0.299, 0.587, 0.114));
          intensity += lum * atten;
        }
        #endif

        // Ambient light
        intensity += dot(ambientLightColor, vec3(0.299, 0.587, 0.114));

        // Clamp to avoid overexposure near light sources
        intensity = min(intensity, 1.2);

        gl_FragColor = vec4(texColor.rgb * tint * intensity, texColor.a);
        #include <fog_fragment>
      }
    `,lights:!0,fog:!0,transparent:!1,side:Pe,depthWrite:!0})}const Ta=.4,G_=Ta/2+.02;function V_(){const i=document.createElement("canvas");i.width=32,i.height=32;const t=i.getContext("2d");t.clearRect(0,0,32,32),t.fillStyle="#DAA520",t.beginPath(),t.arc(10,16,6,0,Math.PI*2),t.fill(),t.fillStyle="#000",t.beginPath(),t.arc(10,16,3,0,Math.PI*2),t.fill(),t.fillStyle="#DAA520",t.fillRect(16,14,12,4),t.fillRect(24,18,4,4),t.fillRect(20,18,3,3);const e=new Qe(i);return e.magFilter=Nt,e.minFilter=Nt,e}function W_(i){const t=new Dt,e=new Map,n=new ve(Ta,Ta),s=V_(),r=ss(s);for(const[o,a]of i.keys){if(a.pickedUp)continue;const c=a.col*I+I/2,l=a.row*I+I/2,u=new tt(n,r);u.position.set(c,G_,l),t.add(u),e.set(o,u)}return{group:t,meshMap:e}}function aM(i,t){const e=i.get(t);e&&(e.removeFromParent(),i.delete(t))}function lM(i,t){const e=t.rotation.y;for(const n of i.values())n.rotation.y=e}const Nc=.8,$_=.02,Ju=.01,Qu=-.005;function Tr(i){const t=document.createElement("canvas");t.width=32,t.height=32;const e=t.getContext("2d"),n=i?40:60,s=i?10:20;for(let o=0;o<32;o++)for(let a=0;a<32;a++){const c=n+Math.floor(Math.random()*s);e.fillStyle=`rgb(${c},${c-5},${c-10})`,e.fillRect(a,o,1,1)}i?(e.strokeStyle="rgba(20, 18, 16, 0.4)",e.lineWidth=1,e.beginPath(),e.moveTo(8,0),e.lineTo(10,32),e.moveTo(22,0),e.lineTo(20,32),e.stroke()):(e.fillStyle="rgba(120, 115, 110, 0.5)",e.fillRect(0,0,32,2),e.fillRect(0,0,2,32),e.fillStyle="rgba(20, 18, 16, 0.5)",e.fillRect(0,30,32,2),e.fillRect(30,0,2,32));const r=new Qe(t);return r.magFilter=Nt,r.minFilter=Nt,r.colorSpace=xe,r}let zi=null,Hi=null;function X_(i){const t=new Dt,e=new Map,n=new jt(Nc,$_,Nc);zi||(zi=new Tt({map:Tr(!1)})),Hi||(Hi=new Tt({map:Tr(!0)}));for(const[s,r]of i.plates){const o=r.col*I+I/2,a=r.row*I+I/2,c=r.activated?Hi:zi,l=new tt(n,c);l.position.set(o,r.activated?Qu:Ju,a),t.add(l),e.set(s,l)}return{group:t,meshMap:e}}function cM(i,t){const e=i.get(t);e&&(Hi||(Hi=new Tt({map:Tr(!0)})),e.material=Hi,e.position.y=Qu)}function uM(i,t){const e=i.get(t);e&&(zi||(zi=new Tt({map:Tr(!1)})),e.material=zi,e.position.y=Ju)}const Fc=.25,Oc=.008;function Y_(i){const t=new Dt,e=new Map,n=new es({color:4473924,transparent:!0,opacity:.1});for(const[s,r]of i.tripwires){if(r.triggered)continue;const o=r.col*I+I/2,a=r.row*I+I/2,c=new ln(Oc,Oc,I,4);c.rotateZ(Math.PI/2);const l=new tt(c,n);r.orientation==="NS"&&(l.rotation.y=Math.PI/2),l.position.set(o,Fc,a),t.add(l),e.set(s,l)}return{group:t,meshMap:e}}function hM(i,t){const e=i.get(t);e&&(e.visible=!1)}const Bc=1.4,q_=16750925,Aa=2.5,K_=10,j_=.8,kc=.25,Z_={N:{dx:0,dz:-1,rotY:0},S:{dx:0,dz:1,rotY:Math.PI},E:{dx:1,dz:0,rotY:-Math.PI/2},W:{dx:-1,dz:0,rotY:Math.PI/2}};function J_(i){const t=new Dt,e=new Map,n=new Map,s=new jt(.08,.12,.15),r=new jt(.04,.04,.18),o=new ln(.03,.025,.35,6),a=new Ts(.06,.12,6),c=new Tt({color:4473924}),l=new Tt({color:5592405}),u=new Tt({color:6702114}),f=new es({color:16755268,fog:!1}),d=new Tt({color:3351057});for(const[m,p]of i.sconces){const _=p.col*I+I/2,g=p.row*I+I/2,h=Z_[p.wall],S=new Dt,b=new tt(s,c);S.add(b);const x=new tt(r,l);x.position.set(0,0,.12),S.add(x);const P=new tt(o,u);P.position.set(0,.15,.2),P.rotation.x=.3,S.add(P);const T=new tt(a,p.lit?f:d);T.position.set(0,.35,.25),S.add(T);const C=I/2-.02;if(S.position.set(_+h.dx*C,Bc,g+h.dz*C),S.rotation.y=h.rotY,t.add(S),e.set(m,S),p.lit){const R=new Xu(q_,Aa,K_,2);R.position.set(_+h.dx*(C-.4),Bc+.3,g+h.dz*(C-.4)),t.add(R),n.set(m,R)}}return{group:t,meshMap:e,lightMap:n}}function fM(i,t,e){const n=i.get(e);if(n){const r=n.children[2],o=n.children[3];r&&(r.visible=!1),o&&(o.visible=!1)}const s=t.get(e);s&&(s.intensity=0)}const zc=new Map;function dM(i,t){for(const[e,n]of i){if(n.intensity===0)continue;let s=zc.get(e);s||(s={target:Aa,timer:Math.random()*kc},zc.set(e,s)),s.timer-=t,s.timer<=0&&(s.target=Aa+(Math.random()-.5)*j_*2,s.timer=.03+Math.random()*kc),n.intensity+=(s.target-n.intensity)*.15}}function th(i){return function(){i|=0,i=i+1831565813|0;let t=Math.imul(i^i>>>15,1|i);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}const Fi=[{path:"/sprites/props/oak-thin.png",width:2.85,height:2.85},{path:"/sprites/props/oak.png",width:3,height:3},{path:"/sprites/props/birch.png",width:2.7,height:2.7},{path:"/sprites/props/bushes.png",width:2.1,height:2.1}],ur=[];function Q_(){if(ur.length===Fi.length)return ur;const i=new kr;for(const t of Fi){const e=i.load(t.path);e.magFilter=Nt,e.minFilter=Nt,e.colorSpace=xe,ur.push(e)}return ur}function tv(i,t){const e=new Dt,n=[];if(!i||i.length===0)return{group:e,instances:n};const s=i.length,r=i[0].length,o=new Set,a=new Set;if(t)for(const p of t)p.solid&&p.wallTexture==="forest"&&(p.seeThrough?a.add(p.char):o.add(p.char));if(o.size===0&&a.size===0)return{group:e,instances:n};const c=Q_(),l=.15,u=1,f=3,d=Fi.map(()=>[]);for(let p=0;p<s;p++)for(let _=0;_<r;_++){if(!a.has(i[p][_]))continue;const g=_*I+I/2,h=p*I+I/2,S=I/2-l,b=_*9173+p*5381,x=th(b),P=u+Math.floor(x()*(f-u+1));for(let T=0;T<P;T++){const C=Math.floor(x()*4),R=Fi[C],y=g+(x()*2-1)*S,v=h+(x()*2-1)*S,A=R.height/2;d[C].push({x:y,y:A,z:v})}}const m=new Ae;for(let p=0;p<Fi.length;p++){const _=d[p];if(_.length===0)continue;const g=Fi[p],h=new ve(g.width,g.height),S=ss(c[p]),b=new C0(h,S,_.length);for(let x=0;x<_.length;x++){const P=_[x];m.position.set(P.x,P.y,P.z),m.rotation.set(0,0,0),m.updateMatrix(),b.setMatrixAt(x,m.matrix)}b.instanceMatrix.needsUpdate=!0,e.add(b),n.push(b)}return{group:e,instances:n}}const hr=new re,Hc=new k,Gc=new li,ev=new li,Vc=new k,nv=new k(0,1,0);function pM(i,t){const e=t.rotation.y;Gc.setFromAxisAngle(nv,e);for(const n of i.instances){const s=n.count;for(let r=0;r<s;r++)n.getMatrixAt(r,hr),hr.decompose(Hc,ev,Vc),hr.compose(Hc,Gc,Vc),n.setMatrixAt(r,hr);n.instanceMatrix.needsUpdate=!0}}const eh=new kr,Ar=new Map;function nh(i){var e;let t=Ar.get(i);if(!t){const n=((e=Pn.getEnemy(i))==null?void 0:e.sprite.path)??"/sprites/skeleton.png";t=eh.load(n),t.magFilter=Nt,t.minFilter=Nt,Ar.set(i,t)}return t}async function mM(){await Promise.all(Pn.getAllEnemies().map(async i=>{if(Ar.has(i.id))return;const t=await eh.loadAsync(i.sprite.path);t.magFilter=Nt,t.minFilter=Nt,Ar.set(i.id,t)}))}function iv(i){const t=new Dt,e=new Map;for(const[n,s]of i.enemies){const r=Pn.getEnemy(s.type),o=(r==null?void 0:r.sprite.size)??qu,a=new ve(o,o),c=nh(s.type),l=ss(c),u=new tt(a,l),f=s.col*I+I/2,d=s.row*I+I/2,m=(r==null?void 0:r.sprite.yOffset)??0;u.position.set(f,o*.5+m,d),t.add(u),e.set(n,u)}return{group:t,meshMap:e}}function gM(i,t,e,n,s,r,o){const a=Pn.getEnemy(i);if(!a)return null;const c=a.sprite.size??qu,l=new ve(c,c),u=nh(i),f=ss(u),d=new tt(l,f),m=t*I+I/2,p=e*I+I/2,_=a.sprite.yOffset??0;return d.position.set(m,c*.5+_+o,p),s.add(d),r.set(n,d),d}function _M(i,t){const e=t.rotation.y;for(const n of i.values())n.visible&&(n.rotation.y=e)}function vM(i,t){const e=i.get(t);e&&(e.visible=!1)}function xM(i,t,e){const n=i.get(t);n&&(i.delete(t),i.set(e,n))}const Rr=I*.4;function ih(){const i=document.createElement("canvas");i.width=64,i.height=64;const t=i.getContext("2d");for(let n=0;n<64;n++)for(let s=0;s<64;s++){const r=70+Math.floor(Math.random()*40);t.fillStyle=`rgb(${r},${r-8},${r-12})`,t.fillRect(s,n,1,1)}for(let n=0;n<10;n++){const s=Math.random()*64,r=Math.random()*64,o=2+Math.random()*4;t.fillStyle=`rgba(30,22,18,${.15+Math.random()*.15})`,t.beginPath(),t.arc(s,r,o,0,Math.PI*2),t.fill()}const e=new Qe(i);return e.magFilter=Nt,e.minFilter=Nt,e.colorSpace=xe,e}let Gi=null,Vi=null;function sv(i){const t=new Dt,e=new Map;Gi||(Gi=new Tt({map:ih()})),Vi||(Vi=new is(Rr,16,12));for(const[n,s]of i.boulders){const r=new tt(Vi,Gi);r.position.set(s.col*I+I/2,Rr,s.row*I+I/2),t.add(r),e.set(n,r)}return{group:t,meshMap:e}}function MM(i,t,e,n,s,r){Gi||(Gi=new Tt({map:ih()})),Vi||(Vi=new is(Rr,16,12));const o=new tt(Vi,Gi);return o.position.set(i*I+I/2,Rr+r,t*I+I/2),n.add(o),s.set(e,o),o}const Cr="/sprites/items/",sh=new kr,Ir=new Map,Pr=new Map;function rv(i){let t=Ir.get(i);return t||(t=sh.load(`${Cr}${i}.png`),t.magFilter=Nt,t.minFilter=Nt,Ir.set(i,t)),t}function yM(i){const t=Pr.get(i);if(t)return t.complete?t:null;const e=new Image;return e.src=`${Cr}${i}.png`,Pr.set(i,e),null}async function SM(i){const t=[...new Set(i)];await Promise.all(t.map(async e=>{if(!Ir.has(e))try{const n=await sh.loadAsync(`${Cr}${e}.png`);n.magFilter=Nt,n.minFilter=Nt,Ir.set(e,n)}catch{}if(!Pr.has(e)){const n=new Image;n.src=`${Cr}${e}.png`,Pr.set(e,n),await n.decode().catch(()=>{})}}))}const ov=.4,av=.35,lv=.3;function Ka(i){return i==="equipment"?ov:av}function rh(i){return Ka(i)/2+.02}function oh(i,t){return i==="consumable"?t==="consumable":t!=="consumable"}function ah(i){return ss(rv(i))}function lh(i,t,e){if(e===0)return{dx:0,dz:0};const n=th(i*7919+t*6271+e*3037),s=n()*Math.PI*2,r=lv*(.4+n()*.6);return{dx:Math.cos(s)*r,dz:Math.sin(s)*r}}function ch(i,t,e,n,s){const r=fe.getItem(t.itemId);if(!r||!oh(i,r.type))return;const o=ah(r.icon),a=Ka(i),c=rh(i),l=t.location,u=l.col,f=l.row,d=u*I+I/2,m=f*I+I/2,p=s!==void 0?`${s}:${X(u,f)}`:X(u,f);let _=0,g=p;for(;n.has(g);)_++,g=`${p}#${_}`;const{dx:h,dz:S}=lh(u,f,_),b=(s??0)*Se,x=new tt(new ve(a,a),o);x.position.set(d+h,c+b,m+S),x.layers.enableAll(),e.add(x),n.set(g,x)}function uh(i,t){const e=new Dt,n=new Map,s=t.entityRegistry.getAllGroundItemsForLevel(t.currentLevelId,t.activeLayerIndex),r=Ka(i),o=rh(i),a=new Map;for(const c of s){const l=fe.getItem(c.itemId);if(!l||!oh(i,l.type))continue;const u=c.location;if(u.kind!=="world")continue;const f=X(u.col,u.row);let d=a.get(f);d||(d=[],a.set(f,d)),d.push(c)}for(const[c,l]of a){const u=l[0].location,f=u.col*I+I/2,d=u.row*I+I/2;for(let m=0;m<l.length;m++){const p=fe.getItem(l[m].itemId);if(!p)continue;const _=ah(p.icon),{dx:g,dz:h}=lh(u.col,u.row,m),S=new tt(new ve(r,r),_);S.position.set(f+g,o,d+h),e.add(S);const b=m===0?c:`${c}#${m}`;n.set(b,S)}}return{group:e,meshMap:n}}function hh(i,t,e){for(const[n,s]of[...i])(n===e||n.startsWith(e+"#"))&&(s.removeFromParent(),i.delete(n))}function fh(i,t){const e=t.rotation.y;for(const n of i.values())n.rotation.y=e}function cv(i){return uh("equipment",i)}function uv(i){return uh("consumable",i)}function wM(i,t,e,n,s){ch("equipment",i,e,n,s)}function bM(i,t,e,n){ch("consumable",i,t,e,n)}function EM(i,t,e){hh(i,t,e)}function TM(i,t,e){hh(i,t,e)}function AM(i,t){fh(i,t)}function RM(i,t){fh(i,t)}const Wc=["fire_damage","life_steal","bonus_str","bonus_dex","hp_regen","crit_bonus","def_boost","torch_range"];let Lr=new Map,dh={poor:.1,common:.5,fine:.25,masterwork:.12,enchanted:.03};async function CM(){const i=await fetch("/data/loot-tables.json");if(!i.ok)throw new Error(`Failed to load loot tables: ${i.status} ${i.statusText}`);const t=await i.json();dh=t.qualityWeights,Lr=new Map;for(const[e,n]of Object.entries(t.enemies))Lr.set(e,n)}function To(){const i=Object.entries(dh),t=i.reduce((n,[,s])=>n+s,0);let e=Math.random()*t;for(const[n,s]of i)if(e-=s,e<0)return n;return i[i.length-1][0]}function hv(i,t){return Math.floor(Math.random()*(t-i+1))+i}function IM(i,t){const e=Lr.get(i),n=e?hv(e.gold[0],e.gold[1]):0,s=[];if(t!=null&&t.guaranteed)for(const r of t.guaranteed){const o=r.quality??To(),a=o==="enchanted"?[Ao()]:[];s.push({itemId:r.itemId,quality:o,modifiers:a})}if(e&&!(t!=null&&t.suppressTable)){for(const r of e.drops)if(Math.random()<r.chance){const o=r.quality??To(),a=o==="enchanted"?[Ao()]:[];s.push({itemId:r.itemId,quality:o,modifiers:a})}}if(t!=null&&t.extra){for(const r of t.extra)if(Math.random()<r.chance){const o=r.quality??To(),a=o==="enchanted"?[Ao()]:[];s.push({itemId:r.itemId,quality:o,modifiers:a})}}return{gold:n,items:s}}function PM(i){return Lr.get(i)}function Ao(){const i=Math.floor(Math.random()*Wc.length);return Wc[i]}const ph={dungeon:{fogColor:0,fogNear:6,fogFar:26,ambientColor:1710626},mist:{fogColor:8030863,fogNear:2,fogFar:14,ambientColor:8952234},forest:{fogColor:1715738,fogNear:4,fogFar:20,ambientColor:3822896},outdoor:{fogColor:8956620,fogNear:20,fogFar:80,ambientColor:12307694}};let Ra="dungeon";function LM(i){return ph[i??Ra]}function DM(i,t,e){Ra=i??"dungeon";const n=ph[Ra];t.background=new kt(n.fogColor),t.fog=new Wa(n.fogColor,n.fogNear,n.fogFar),e.color.setHex(n.ambientColor)}function UM(i,t,e,n){const s=i.fog;if(!s)return;s.near+=(e.fogNear-s.near)*n,s.far+=(e.fogFar-s.far)*n,s.color.lerp(new kt(e.fogColor),n);const r=i.background;r&&r.lerp(new kt(e.fogColor),n),t.color.lerp(new kt(e.ambientColor),n)}function mh(i,t,e,n){if(!n)return e;let s=e;for(const r of n)r.environment&&i>=r.fromCol&&i<=r.toCol&&t>=r.fromRow&&t<=r.toRow&&(s=r.environment);return s}function NM(i,t,e){const n=new Map,s=new Map,r=[],o=i.length,a=i[0].length;for(let c=0;c<o;c++)for(let l=0;l<a;l++){const u=mh(l,c,t,e);s.has(u)||(r.push(u),s.set(u,r.length)),n.set(`${l},${c}`,s.get(u))}return{zoneMap:n,zones:r,multiZone:r.length>1}}function FM(i,t,e,n){const s=new Map;for(let c=0;c<n.length;c++)s.set(n[c],c+1);const r=new Map,o=i.length,a=i[0].length;for(let c=0;c<o;c++)for(let l=0;l<a;l++){const u=mh(l,c,t,e);r.set(`${l},${c}`,s.get(u)??1)}return r}const $c=I*.85,Xc=Rt*.7;function fv(){const i=document.createElement("canvas");i.width=32,i.height=32;const t=i.getContext("2d");for(let n=0;n<32;n++)for(let s=0;s<32;s++){const r=80+Math.floor(Math.random()*30);t.fillStyle=`rgb(${r},${r-5},${r-8})`,t.fillRect(s,n,1,1)}t.fillStyle="rgba(140, 135, 130, 0.4)",t.fillRect(0,0,32,2),t.fillRect(0,0,2,32),t.fillStyle="rgba(30, 28, 26, 0.4)",t.fillRect(0,30,32,2),t.fillRect(30,0,2,32);const e=new Qe(i);return e.magFilter=Nt,e.minFilter=Nt,e.colorSpace=xe,e}let Ro=null;function dv(i){const t=new Dt,e=new Map;Ro||(Ro=new Tt({map:fv()}));const n=new jt($c,Xc,$c);for(const[s,r]of i.blocks){const o=r.col*I+I/2,a=r.row*I+I/2,c=new tt(n,Ro);c.position.set(o,Xc/2,a),t.add(c),e.set(s,c)}return{group:t,meshMap:e}}function OM(i,t,e,n,s,r,o){const a=i.get(t);if(!a)return;const c=a;i.delete(t),i.set(s,c);const l=r*I+I/2,u=o*I+I/2,f=c.position.x,d=c.position.z,m=300,p=performance.now();function _(){const g=performance.now()-p,h=Math.min(1,g/m),S=h*(2-h);c.position.x=f+(l-f)*S,c.position.z=d+(u-d)*S,h<1&&requestAnimationFrame(_)}requestAnimationFrame(_)}const pv={S:0,W:Math.PI/2,N:Math.PI,E:-Math.PI/2},Yc=.6,xs=.4,fr=.3,qc=.12,mv=.01;function Kc(i){const t=document.createElement("canvas");t.width=32,t.height=32;const e=t.getContext("2d"),n=i?100:80,s=i?60:45,r=i?30:20;for(let a=0;a<32;a++)for(let c=0;c<32;c++){const l=Math.floor(Math.random()*20);e.fillStyle=`rgb(${n+l},${s+l},${r+l})`,e.fillRect(c,a,1,1)}e.strokeStyle=`rgba(${n-20},${s-15},${r-10},0.3)`,e.lineWidth=1;for(let a=4;a<32;a+=6)e.beginPath(),e.moveTo(0,a+Math.random()*2),e.lineTo(32,a+Math.random()*2),e.stroke();i||(e.fillStyle="rgba(60, 60, 65, 0.5)",e.fillRect(0,14,32,3));const o=new Qe(t);return o.magFilter=Nt,o.minFilter=Nt,o.colorSpace=xe,o}let Co=null,Io=null;const gv=new Tt({color:13412915});function _v(i){const t=new Dt,e=new Map;Co||(Co=new Tt({map:Kc(!1)})),Io||(Io=new Tt({map:Kc(!0)}));const n=new jt(Yc,fr,xs),s=new jt(Yc,qc,xs),r=new jt(.08,.06,.02);for(const[o,a]of i.chests){const c=a.col*I+I/2,l=a.row*I+I/2,u=new Dt,f=new tt(n,Co);f.position.set(0,fr/2,0),u.add(f);const d=new tt(r,gv);d.position.set(0,fr/2,xs/2+.01),u.add(d);const m=new Dt;m.position.set(0,fr,-xs/2);const p=new tt(s,Io);p.position.set(0,qc/2,xs/2),m.add(p),a.state==="open"&&(m.rotation.x=-Math.PI/4),u.add(m),u.position.set(c,mv,l),u.rotation.y=pv[a.facing??"S"],t.add(u),e.set(o,u)}return{group:t,meshMap:e}}function BM(i,t){const e=i.get(t);if(!e)return;const n=e.children.find(l=>l instanceof Dt);if(!n)return;const s=-Math.PI/4,r=400,o=n.rotation.x,a=performance.now();function c(){const l=performance.now()-a,u=Math.min(1,l/r),f=u*(2-u);n.rotation.x=o+(s-o)*f,u<1&&requestAnimationFrame(c)}requestAnimationFrame(c)}function kM(i,t){var n;const e=i.get(t);e&&((n=e.parent)==null||n.remove(e),i.delete(t))}function zM(i,t){const e=i.get(t);if(!e)return;const n=e.children.find(c=>c instanceof Dt);if(!n)return;const s=400,r=n.rotation.x,o=performance.now();function a(){const c=performance.now()-o,l=Math.min(1,c/s),u=l*(2-l);n.rotation.x=r*(1-u),l<1&&requestAnimationFrame(a)}requestAnimationFrame(a)}function vv(i){const t=new Dt,e=new Map,n=new ln(.35,.35,.5,8),s=new Tt({color:8947848}),r=new ln(.08,.08,.6,6),o=new Tt({color:10066329}),a=new Br(.3,8),c=new Tt({color:4491468,transparent:!0,opacity:.6});for(const[l,u]of i.fountains){const f=u.col*I+I/2,d=u.row*I+I/2,m=new Dt,p=new tt(n,s);p.position.set(0,.25,0),m.add(p);const _=new tt(r,o);_.position.set(0,.3,0),m.add(_);const g=new tt(a,c);g.name="water",g.rotation.x=-Math.PI/2,g.position.set(0,.51,0),m.add(g),u.state==="used"&&(g.visible=!1),m.position.set(f,0,d),t.add(m),e.set(l,m)}return{group:t,meshMap:e}}function HM(i,t){const e=i.get(t);e&&e.traverse(n=>{n.name==="water"&&(n.visible=!1)})}function xv(i){const t=new Dt,e=new Map,n=new jt(1.2,.2,1.2),s=new Tt({color:7829367}),r=new jt(.5,.55,.5);for(const[o,a]of i.altars){const c=a.col*I+I/2,l=a.row*I+I/2,u=new Dt,f=new tt(n,s);f.position.set(0,0,0),u.add(f);const d=a.state==="active"?new Tt({color:10066329,emissive:new kt(4469504),emissiveIntensity:.5}):new Tt({color:10066329}),m=new tt(r,d);m.name="pillar",m.position.set(0,.375,0),u.add(m),u.position.set(c,.1,l),t.add(u),e.set(o,u)}return{group:t,meshMap:e}}function GM(i,t){const e=i.get(t);e&&e.traverse(n=>{n.name==="pillar"&&n instanceof tt&&n.material.emissive.setHex(0)})}const gh=new kr,Dr=new Map;function Mv(i){var e;let t=Dr.get(i);if(!t){const n=((e=Zi.getNpc(i))==null?void 0:e.sprite.path)??"/sprites/merchant.png";t=gh.load(n),t.magFilter=Nt,t.minFilter=Nt,Dr.set(i,t)}return t}async function VM(){await Promise.all(Zi.getAllNpcs().map(async i=>{if(Dr.has(i.id))return;const t=await gh.loadAsync(i.sprite.path);t.magFilter=Nt,t.minFilter=Nt,Dr.set(i.id,t)}))}function yv(i){const t=new Dt,e=new Map;for(const[n,s]of i){const r=Zi.getNpc(s.npcId),o=(r==null?void 0:r.sprite.size)??d_,a=new ve(o,o),c=Mv(s.npcId),l=ss(c),u=new tt(a,l),f=s.col*I+I/2,d=s.row*I+I/2,m=(r==null?void 0:r.sprite.yOffset)??0;u.position.set(f,o*.5+m,d),t.add(u),e.set(n,u)}return{group:t,meshMap:e}}function WM(i,t){const e=t.rotation.y;for(const n of i.values())n.visible&&(n.rotation.y=e)}const Sv={N:{dx:0,dz:-1,rotY:0},S:{dx:0,dz:1,rotY:Math.PI},E:{dx:1,dz:0,rotY:-Math.PI/2},W:{dx:-1,dz:0,rotY:Math.PI/2}};function wv(i){const t=new Dt,e=new Map,n=new ln(.25,.25,Rt,8),s=new jt(.15,.1,.12),r=new Ts(.15,.6,6),o=new Ts(.18,.5,6),a=new jt(.5,.3,.5),c=new jt(.3,.5,.2),l=new jt(.2,.2,.2),u=new jt(.6,.4,.5),f=new jt(.45,.35,.4),d=new ve(.5,.7),m=new Tt({color:8947848}),p=new Tt({color:6710886}),_=new Tt({color:7829350}),g=new Tt({color:5592405}),h=new Tt({color:7829367}),S=new Tt({color:9136404}),b=new Tt({color:10189092}),x=new Tt({color:9116186,side:Pe});for(const[P,T]of i.props){const C=T.col*I+I/2,R=T.row*I+I/2,y=new Dt;switch(y.position.set(C,0,R),T.propId){case"pillar":{const v=new tt(n,m);v.position.set(0,Rt/2,0),y.add(v);break}case"rubble":{const v=[[(T.col*7+T.row*13)%5/10-.25,(T.col*11+T.row*7)%5/10-.25],[(T.col*13+T.row*3)%5/10-.25,(T.col*5+T.row*11)%5/10-.25],[(T.col*3+T.row*17)%5/10-.25,(T.col*17+T.row*5)%5/10-.25],[(T.col*19+T.row*2)%5/10-.25,(T.col*2+T.row*19)%5/10-.25]];for(const[A,H]of v){const L=new tt(s,p);L.position.set(A,.05,H),y.add(L)}break}case"stalactite":{const v=new tt(r,_);v.rotation.z=Math.PI,v.position.set(0,Rt-.3,0),y.add(v);break}case"stalagmite":{const v=new tt(o,_);v.position.set(0,.25,0),y.add(v);break}case"statue":{const v=new tt(a,g);v.position.set(0,.15,0),y.add(v);const A=new tt(c,h);A.position.set(0,.55,0),y.add(A);const H=new tt(l,h);H.position.set(0,.9,0),y.add(H),y.rotation.y=(T.rotation??0)*Math.PI/2;break}case"crate_stack":{const v=new tt(u,S);v.position.set(0,.2,0),y.add(v);const A=new tt(f,b);A.position.set(.05,.575,0),y.add(A),y.rotation.y=(T.rotation??0)*Math.PI/2;break}case"banner":{const v=T.wall??"N",A=Sv[v],H=I/2-.02,L=new tt(d,x);L.position.set(A.dx*H,Rt*.65,A.dz*H),L.rotation.y=A.rotY,y.add(L);break}}t.add(y),e.set(P,y)}return{group:t,meshMap:e}}function bv(i){const t=new Dt,e=new Map,n=new ln(.38,.34,.8,8),s=new Tt({color:9133628}),r=new ln(.39,.39,.03,8),o=new Tt({color:3355443}),a=[-.18,.18];for(const[c,l]of i.barrels){const u=l.col*I+I/2,f=l.row*I+I/2,d=new Dt,m=new tt(n,s);m.position.set(0,0,0),d.add(m);for(const p of a){const _=new tt(r,o);_.position.set(0,p,0),d.add(_)}d.position.set(u,.4,f),t.add(d),e.set(c,d)}return{group:t,meshMap:e}}const Ca=4,un=.25,hn=I/Ca,fn=I*.85,dr=(I-fn)/2,Ev=new es({color:0}),jc=new Map,Zc=new Map,Jc=new Map;function Tv(i){let t=jc.get(i);return t||(t=new Tt({map:Is(i),vertexColors:!0}),jc.set(i,t)),t}function Av(i){let t=Zc.get(i);if(!t){const e=Hr(i);e.wrapS=Ye,e.wrapT=Ye,t=new Tt({map:e,vertexColors:!0}),Zc.set(i,t)}return t}function Rv(i){let t=Jc.get(i);return t||(t=new Tt({map:Ya(i),vertexColors:!0}),Jc.set(i,t)),t}function pr(i,t){const e=i.getAttribute("position"),n=e.count,s=new Float32Array(n*3),r=I/2;for(let o=0;o<n;o++){const c=(t+e.getZ(o)+r)/I,l=Math.max(0,Math.min(1,c));s[o*3]=l,s[o*3+1]=l,s[o*3+2]=l}i.setAttribute("color",new Le(s,3))}const Cv={S:0,E:Math.PI/2,N:Math.PI,W:-Math.PI/2};function Iv(i,t,e,n,s,r=!0,o=!0){const a=new Dt,c=i==="down";function l(p,_,g,h){const S=p.getAttribute("uv"),b=_/I,x=g/I,P=h/I;for(const T of[0,4])for(let C=0;C<4;C++)S.setX(T+C,S.getX(T+C)*P),S.setY(T+C,S.getY(T+C)*x);for(const T of[8,12])for(let C=0;C<4;C++)S.setX(T+C,S.getX(T+C)*b),S.setY(T+C,S.getY(T+C)*P);for(const T of[16,20])for(let C=0;C<4;C++)S.setX(T+C,S.getX(T+C)*b),S.setY(T+C,S.getY(T+C)*x);S.needsUpdate=!0}for(let p=0;p<Ca;p++){const _=I/2-hn/2-p*hn;if(c){const g=-p*un,h=new jt(fn,un,hn);l(h,fn,un,hn),pr(h,_);const S=new tt(h,e);S.position.set(0,g-un/2,_),a.add(S)}else{const g=(p+1)*un,h=new jt(fn,g,hn);l(h,fn,g,hn),pr(h,_);const S=new tt(h,e);S.position.set(0,g/2,_),a.add(S)}}for(let p=0;p<Ca;p++){const _=I/2-hn/2-p*hn;let g=Rt;c?g-=p*un:g+=p*un;const h=new jt(fn,un,hn);l(h,fn,un,hn),pr(h,_);const S=new tt(h,s);S.position.set(0,g+un/2,_),a.add(S)}if(r||o){const p=Rt*2,_=new jt(dr,p,I),g=dr/I,h=p/Rt,S=_.getAttribute("uv");for(const b of[0,4])for(let x=0;x<4;x++)S.setY(b+x,S.getY(b+x)*h);for(const b of[8,12])for(let x=0;x<4;x++)S.setX(b+x,S.getX(b+x)*g);for(const b of[16,20])for(let x=0;x<4;x++)S.setX(b+x,S.getX(b+x)*g),S.setY(b+x,S.getY(b+x)*h);if(S.needsUpdate=!0,pr(_,0),r){const b=new tt(_,n);b.position.set(-fn/2-dr/2,c?0:Rt,0),a.add(b)}if(o){const b=new tt(_,n);b.position.set(fn/2+dr/2,c?0:Rt,0),a.add(b)}}const u=Rt*2,f=new ve(fn,u),d=new tt(f,Ev),m=c?0:Rt;return d.position.set(0,m,-I/2),a.add(d),a.rotation.y=Cv[t],a}const Pv={S:{left:[-1,0],right:[1,0]},N:{left:[1,0],right:[-1,0]},E:{left:[0,-1],right:[0,1]},W:{left:[0,1],right:[0,-1]}};function Qc(i,t,e,n){return!i||n<0||n>=i.length||e<0||e>=i[n].length?!0:t?!t.has(i[n][e]):i[n][e]==="#"}function Lv(i,t,e,n,s,r){var c;const o=new Dt,a=new Map;if(s)for(const l of s)a.set(l.char,l);for(const[,l]of i){const{col:u,row:f,direction:d,facing:m}=l,p=((c=n==null?void 0:n[f])==null?void 0:c[u])??".",_=ri(u,f,p,t,a,e),g=Tv(_.floor),h=Av(_.wall),S=Rv(_.ceiling),b=Pv[m],x=Qc(n,r,u+b.left[0],f+b.left[1]),P=Qc(n,r,u+b.right[0],f+b.right[1]),T=Iv(d,m,g,h,S,x,P),C=u*I+I/2,R=f*I+I/2;T.position.set(C,0,R),o.add(T)}return{group:o}}const tu=[{dc:0,dr:-1,rotY:Math.PI,ox:0,oz:-I/2},{dc:0,dr:1,rotY:0,ox:0,oz:I/2},{dc:1,dr:0,rotY:Math.PI/2,ox:I/2,oz:0},{dc:-1,dr:0,rotY:-Math.PI/2,ox:-I/2,oz:0}];function Dv(i,t,e,n,s,r,o,a){const c=new Dt,l=new Map,u=Er(s),f=zr(s),d=new ve(I,Rt),m=new ve(I,I),p=new Map;function _(S){const b="w_"+S;let x=p.get(b);return x||(x=new Tt({map:Hr(S)}),p.set(b,x)),x}function g(S){const b="f_"+S;let x=p.get(b);return x||(x=new Tt({map:Is(S)}),p.set(b,x)),x}function h(S){const b="c_"+S;let x=p.get(b);return x||(x=new Tt({map:Ya(S)}),p.set(b,x)),x}for(const[S,b]of i){const{col:x,row:P}=b,T=x*I+I/2,C=P*I+I/2,R=new Dt,y=new Dt;y.visible=!1;let v=ri(x,P,t[P][x],e,u,n);for(const L of tu){const z=x+L.dc,$=P+L.dr;if($>=0&&$<t.length&&z>=0&&z<t[0].length&&f.has(t[$][z])){v=ri(z,$,t[$][z],e,u,n);break}}for(const L of tu){const z=x+L.dc,$=P+L.dr,Z=$>=0&&$<t.length&&z>=0&&z<t[0].length&&f.has(t[$][z]),N=i.has(X(z,$));if(Z){const mt=ri(z,$,t[$][z],e,u,n).wall,lt=new tt(d,_(mt));lt.position.set(T+L.ox,Rt/2,C+L.oz),lt.rotation.y=L.rotY,R.add(lt)}else if(!N){const at=new tt(d,_(v.wall));at.position.set(T+L.ox,Rt/2,C+L.oz),at.rotation.y=L.rotY+Math.PI,y.add(at)}}const A=As(a,x,P,u,n,"openBottom"),H=As(o,x,P,u,n,"openTop");if(!A){const L=new tt(m,g(v.floor));L.rotation.x=-Math.PI/2,L.position.set(T,0,C),y.add(L)}if(!H){const L=new tt(m,h(v.ceiling));L.rotation.x=Math.PI/2,L.position.set(T,Rt,C),y.add(L)}c.add(R),c.add(y),l.set(S,{wallGroup:R,floorCeilGroup:y})}return{group:c,meshMap:l}}function Uv(i){const t=new Dt,e=new Map;for(const[n,s]of i.thinWalls){const r=Nv(s);t.add(r),e.set(n,r)}return{group:t,meshMap:e}}function Nv(i){const t=new Dt,e=i.height==="half"?Rt*.5:Rt,n=e/2,s=i.col*I+I/2,r=i.row*I+I/2,o=yc(i.texture),a=i.textureBack?yc(i.textureBack):o,c=new ve(I,e);if(a===o){const l=new Tt({map:o,side:Pe,alphaTest:.5}),u=new tt(c,l);u.position.y=n,t.add(u)}else{const l=new Tt({map:o,side:_n,alphaTest:.5}),u=new Tt({map:a,side:_n,alphaTest:.5}),f=new tt(c,l);f.position.y=n,t.add(f);const d=new tt(c.clone(),u);d.position.y=n,d.rotation.y=Math.PI,t.add(d)}return i.wall==="S"?(t.position.set(s,0,r+I/2),t.rotation.y=Math.PI):(t.position.set(s+I/2,0,r),t.rotation.y=-Math.PI/2),t}const Ur=8,mr=Se/Ur,Ms=I/Ur,Po=Math.sqrt(I*I+Se*Se),Fv={N:0,E:-Math.PI/2,S:Math.PI,W:Math.PI/2},eu=new Map,nu=new Map,iu=new Map;function Ov(i){let t=eu.get(i);if(!t){const e=Is(i);e.wrapS=Ye,e.wrapT=Ye,t=new Tt({map:e,side:Pe}),eu.set(i,t)}return t}function su(i){let t=nu.get(i);if(!t){const e=Hr(i);e.wrapS=Ye,e.wrapT=Ye,t=new Tt({map:e,side:Pe}),nu.set(i,t)}return t}function Bv(i){let t=iu.get(i);if(!t){const e=Is(i);e.wrapS=Ye,e.wrapT=Ye,t=new Tt({map:e}),iu.set(i,t)}return t}function ru(i,t,e=!0){const n=I/2,s=i<0?-1:1,r=Rt,o=[],a=[],c=[];if(i<0?je(o,a,c,[i,0,n],[i,Se,-n],[i,Se,-n],[i,0,-n],[0,0],[1,1],[1,1],[1,0],s,0,0):je(o,a,c,[i,0,n],[i,0,-n],[i,Se,-n],[i,Se,-n],[0,0],[1,0],[1,1],[1,1],s,0,0),e){const f=-I,d=I/I;i<0?je(o,a,c,[i,0,0],[i,r,0],[i,r,f],[i,0,f],[0,0],[0,1],[d,1],[d,0],s,0,0):je(o,a,c,[i,0,f],[i,r,f],[i,r,0],[i,0,0],[d,0],[d,1],[0,1],[0,0],s,0,0)}const l=new De;return l.setAttribute("position",new me(o,3)),l.setAttribute("uv",new me(a,2)),l.setAttribute("normal",new me(c,3)),new tt(l,t)}function kv(i,t,e,n,s){const r=new Dt,o=I/2,a=Po/I,c=new Float32Array([-o,0,o,o,0,o,o,Se,-o,-o,0,o,o,Se,-o,-o,Se,-o]),l=new Float32Array([0,0,1,0,1,a,0,0,1,a,0,a]),u=0,f=I/Po,d=Se/Po,m=new Float32Array([u,f,d,u,f,d,u,f,d,u,f,d,u,f,d,u,f,d]),p=new De;p.setAttribute("position",new Le(c,3)),p.setAttribute("uv",new Le(l,2)),p.setAttribute("normal",new Le(m,3));const _=new tt(p,i);return r.add(_),r.add(ru(-o,t,n)),r.add(ru(o,e,s)),r}function je(i,t,e,n,s,r,o,a,c,l,u,f,d,m){i.push(...n,...s,...r),t.push(...a,...c,...l),e.push(f,d,m,f,d,m,f,d,m),i.push(...n,...r,...o),t.push(...a,...l,...u),e.push(f,d,m,f,d,m,f,d,m)}function zv(i,t,e,n,s){const r=new Dt,o=I/2,a=[],c=[],l=[];for(let f=0;f<Ur;f++){const d=mr*f,m=mr*(f+1),p=I/2-f*Ms,_=I/2-(f+1)*Ms,g=I/I,h=Ms/I,S=mr/Rt;je(a,c,l,[-o,m,p],[o,m,p],[o,m,_],[-o,m,_],[0,0],[g,0],[g,h],[0,h],0,1,0),je(a,c,l,[-o,d,p],[o,d,p],[o,m,p],[-o,m,p],[0,0],[g,0],[g,S],[0,S],0,0,1)}je(a,c,l,[-o,0,o],[o,0,o],[o,0,-o],[-o,0,-o],[0,0],[1,0],[1,1],[0,1],0,-1,0),je(a,c,l,[o,0,-o],[-o,0,-o],[-o,Se,-o],[o,Se,-o],[0,0],[1,0],[1,Se/Rt],[0,Se/Rt],0,0,-1);const u=new De;u.setAttribute("position",new me(a,3)),u.setAttribute("uv",new me(c,2)),u.setAttribute("normal",new me(l,3)),r.add(new tt(u,i));for(const f of[-1,1]){const d=o*f,m=f,p=[],_=[],g=[];for(let b=0;b<Ur;b++){const x=mr*(b+1),P=I/2-b*Ms,T=I/2-(b+1)*Ms,C=(o-P+o)/I,R=(o-T+o)/I,y=x/Rt;f<0?je(p,_,g,[d,0,P],[d,x,P],[d,x,T],[d,0,T],[C,0],[C,y],[R,y],[R,0],m,0,0):je(p,_,g,[d,0,P],[d,0,T],[d,x,T],[d,x,P],[C,0],[R,0],[R,y],[C,y],m,0,0)}if(f<0?n:s){const x=-I,P=I/I;f<0?je(p,_,g,[d,0,0],[d,Rt,0],[d,Rt,x],[d,0,x],[0,0],[0,1],[P,1],[P,0],m,0,0):je(p,_,g,[d,0,x],[d,Rt,x],[d,Rt,0],[d,0,0],[P,0],[P,1],[0,1],[0,0],m,0,0)}const S=new De;S.setAttribute("position",new me(p,3)),S.setAttribute("uv",new me(_,2)),S.setAttribute("normal",new me(g,3)),r.add(new tt(S,f<0?t:e))}return r}const Hv={N:{left:[-1,0],right:[1,0]},S:{left:[1,0],right:[-1,0]},E:{left:[0,-1],right:[0,1]},W:{left:[0,1],right:[0,-1]}};function ou(i,t,e,n,s){return n<0||n>=i.length||e<0||e>=i[n].length?!0:s!=null&&s.has(`${e},${n}`)?!1:!t.has(i[n][e])}function Gv(i,t,e,n,s,r,o){const a=new Map;if(s)for(const A of s)a.set(A.char,A);const c=t[i.row]&&t[i.row][i.col]||".",u=ri(i.col,i.row,c,n,a,r).floor,[f,d]=Oe[i.facing],m=i.col+f,p=i.row+d,_=Hv[i.facing],g=ou(t,e,m+_.left[0],p+_.left[1],o),h=ou(t,e,m+_.right[0],p+_.right[1],o),S=t[p]&&t[p][m]||"#",x=ri(m,p,S,n,a,r).wall;let P;if(i.style==="stairs"){const A=Bv(u),H=su(x);P=zv(A,H,H,g,h)}else{const A=Ov(u),H=su(x);P=kv(A,H,H,g,h)}P.rotation.y=Fv[i.facing];const T=i.col*I+I/2,C=i.row*I+I/2,R={N:[0,-I/2],S:[0,I/2],E:[I/2,0],W:[-I/2,0]},[y,v]=R[i.facing];return P.position.set(T+y,0,C+v),P}function Vv(i,t,e,n,s,r){const o=new Dt,a=new Map,c=r??zr(n),l=new Set;for(const u of i.ramps.values()){const[f,d]=Oe[u.facing];l.add(`${u.col+f},${u.row+d}`)}for(const[u,f]of i.ramps){const d=Gv(f,t,c,e,n,s,l);o.add(d),a.set(u,d)}return{group:o,meshMap:a}}const Wv=1.2,au=.15,Lo=.3,lu=.02,$v=-1.047,Xv=1.047,Yv={N:{dx:0,dz:-1,rotY:0},S:{dx:0,dz:1,rotY:Math.PI},E:{dx:1,dz:0,rotY:-Math.PI/2},W:{dx:-1,dz:0,rotY:Math.PI/2}};function qv(i){const t=new Dt,e=new Map,n=new Tt({color:5592405}),s=new Tt({color:8939076}),r=new Tt({color:4473924}),o=new jt(au,au,.04),a=new ln(lu,lu,Lo,6),c=new is(.04,6,6);for(const[l,u]of i.levers){const f=u.col*I+I/2,d=u.row*I+I/2,m=Yv[u.wall],p=new Dt,_=new tt(o,n);p.add(_);const g=new Dt;g.position.set(0,0,.02);const h=new tt(a,s);h.rotation.x=Math.PI/2,h.position.set(0,0,Lo/2),g.add(h);const S=new tt(c,r);S.position.set(0,0,Lo),g.add(S);const b=u.state==="up"?$v:Xv;g.rotation.x=b,p.add(g);const x=I/2-.02;p.position.set(f+m.dx*x,Wv,d+m.dz*x),p.rotation.y=m.rotY,t.add(p),e.set(l,g)}return{group:t,handleMap:e}}const Kv=1.2,jv=.2,Zv=.15,Ia=.1,Jv=.1,Qv=.07,_h=.02,tx={N:{dx:0,dz:-1,rotY:0},S:{dx:0,dz:1,rotY:Math.PI},E:{dx:1,dz:0,rotY:-Math.PI/2},W:{dx:-1,dz:0,rotY:Math.PI/2}},ex={N:"S",S:"N",E:"W",W:"E"},nx=new jt(jv,Zv,Ia),ix=new jt(Jv,Qv,_h),sx=new Tt({color:3355443}),rx=new Tt({color:1118481});function ox(i){const t=new Dt;for(const[,e]of i.trapLaunchers){const n=ex[e.facing],s=tx[n],r=e.col*I+I/2,o=e.row*I+I/2,a=new Dt,c=new tt(nx,sx);a.add(c);const l=new tt(ix,rx);l.position.set(0,0,Ia/2+_h/2),a.add(l);const u=I/2-Ia/2;a.position.set(r+s.dx*u,Kv,o+s.dz*u),a.rotation.y=s.rotY,t.add(a)}return{group:t}}const ax=.4,lx=.3,cx=1.1,ux={N:{dx:0,dz:-1,rotY:0},S:{dx:0,dz:1,rotY:Math.PI},E:{dx:1,dz:0,rotY:-Math.PI/2},W:{dx:-1,dz:0,rotY:Math.PI/2}};function hx(){const i=document.createElement("canvas");i.width=32,i.height=32;const t=i.getContext("2d");for(let n=0;n<32;n++)for(let s=0;s<32;s++){const r=Math.floor(Math.random()*15);t.fillStyle=`rgb(${200+r},${180+r},${140+r})`,t.fillRect(s,n,1,1)}t.strokeStyle="rgba(80, 60, 30, 0.6)",t.lineWidth=2,t.strokeRect(1,1,30,30),t.fillStyle="rgba(60, 40, 20, 0.3)";for(let n=8;n<28;n+=5)t.fillRect(5,n,22,1);const e=new Qe(i);return e.magFilter=Nt,e.minFilter=Nt,e.colorSpace=xe,e}let Do=null;function fx(i){const t=new Dt,e=new Map;Do||(Do=new Tt({map:hx()}));const n=new ve(ax,lx);for(const[s,r]of i.signs){const o=r.col*I+I/2,a=r.row*I+I/2,c=ux[r.wall],l=I/2-.01,u=new tt(n,Do);u.position.set(o+c.dx*l,cx,a+c.dz*l),u.rotation.y=c.rotY,t.add(u),e.set(s,u)}return{group:t,meshMap:e}}const dx={N:{dx:0,dz:-1,rotY:Math.PI},S:{dx:0,dz:1,rotY:0},E:{dx:1,dz:0,rotY:Math.PI/2},W:{dx:-1,dz:0,rotY:-Math.PI/2}},px=[13382451,3368652,3381555],mx=[-.3,0,.3];function gx(i){const t=new Dt,e=new Map,n=new jt(1.2,1.8,.2),s=new Tt({color:4861984}),r=new jt(1,.1,.02);for(const[o,a]of i.bookshelves){const c=a.col*I+I/2,l=a.row*I+I/2,u=dx[a.wall],f=I/2-.1,d=new Dt,m=new tt(n,s);d.add(m);for(let p=0;p<3;p++){const _=new Tt({color:px[p]}),g=new tt(r,_);g.position.set(0,mx[p],.11),d.add(g)}d.position.set(c+u.dx*f,.9,l+u.dz*f),d.rotation.y=u.rotY,t.add(d),e.set(o,d)}return{group:t,meshMap:e}}function _x(){const i=document.createElement("canvas");i.width=64,i.height=64;const t=i.getContext("2d"),e=32,n=32;t.strokeStyle="#6b1a3a",t.lineWidth=2,t.beginPath(),t.arc(e,n,28,0,Math.PI*2),t.stroke(),t.beginPath(),t.arc(e,n,18,0,Math.PI*2),t.stroke(),t.beginPath(),t.moveTo(e-28,n),t.lineTo(e+28,n),t.moveTo(e,n-28),t.lineTo(e,n+28),t.stroke(),t.fillStyle="#6b1a3a";for(const[r,o]of[[-22,-22],[22,-22],[-22,22],[22,22]])t.beginPath(),t.arc(e+r,n+o,2,0,Math.PI*2),t.fill();const s=new Qe(i);return s.magFilter=Nt,s.minFilter=Nt,s.colorSpace=xe,s}function vx(i){const t=new Dt,e=new Map,n=new Br(.35,16),s=new Tt({map:_x(),transparent:!0,opacity:.8});for(const[r,o]of i.spawners){if(!o.visible)continue;const a=new tt(n,s);a.rotation.x=-Math.PI/2,a.position.set(o.col*I+I/2,.01,o.row*I+I/2),t.add(a),e.set(r,a)}return{group:t,meshMap:e}}const cu={N:"S",S:"N",E:"W",W:"E"};function xx(i,t){const e=new Map;function n(r,o){const a=e.get(r);if(!a){e.set(r,o);return}for(const c of o.wallDirs)a.wallDirs.includes(c)||a.wallDirs.push(c);a.skipCeiling=a.skipCeiling||o.skipCeiling,a.skipFloor=a.skipFloor||o.skipFloor,o.keepHalf!==void 0&&a.keepHalf===void 0&&(a.keepHalf=o.keepHalf),o.floorKeepHalf!==void 0&&a.floorKeepHalf===void 0&&(a.floorKeepHalf=o.floorKeepHalf)}for(const r of i.ramps.values()){n(X(r.col,r.row),{wallDirs:[r.facing],skipCeiling:!0,skipFloor:!1});const[o,a]=Oe[r.facing],c=r.col+o,l=r.row+a;n(X(c,l),{wallDirs:[cu[r.facing]],skipCeiling:!1,skipFloor:!1,keepHalf:r.facing})}if(t>0){const r=i.activeLayerIndex;i.activeLayerIndex=t-1;for(const o of i.ramps.values()){const[a,c]=Oe[o.facing],l=o.col+a,u=o.row+c;n(X(l,u),{wallDirs:[cu[o.facing]],skipCeiling:!1,skipFloor:!1,floorKeepHalf:o.facing})}i.activeLayerIndex=r}const s=new Map;for(const r of i.ramps.values()){const[o,a]=Oe[r.facing],c=r.col+o,l=r.row+a;r.facing==="N"||r.facing==="S"?(s.set(`${X(c+1,l)}:W`,r.facing),s.set(`${X(c-1,l)}:E`,r.facing)):(s.set(`${X(c,l+1)}:N`,r.facing),s.set(`${X(c,l-1)}:S`,r.facing))}return{rampOpenCells:e,rampHalfWalls:s}}function $M(i,t,e,n,s){var mt,lt;const r=new Dt,o=[],a=[],c=t.defaults??e.defaults,l=t.areas??e.areas,u=new Map;for(const[ct,qt]of i.breakableWalls)u.set(ct,qt);for(const[ct,qt]of i.secretWalls)u.set(ct,qt);if(u.size>0){const ct=i.activeLayerIndex,qt=(mt=e.layers[ct+1])==null?void 0:mt.grid,Y=(lt=e.layers[ct-1])==null?void 0:lt.grid,nt=Dv(u,t.grid,c,l,e.charDefs,void 0,qt,Y);nt.group.position.y=s,r.add(nt.group)}const f=H_(t.grid,i,n);f.group.position.y=s,r.add(f.group);const d=J_(i);d.group.position.y=s,r.add(d.group);const m=Lv(i.stairs,c,l,t.grid,e.charDefs,n);m.group.position.y=s,r.add(m.group);const p=dv(i);p.group.position.y=s,r.add(p.group);const _=bv(i);_.group.position.y=s,r.add(_.group);const g=wv(i);g.group.position.y=s,r.add(g.group);const h=Uv(i);h.group.position.y=s,r.add(h.group);const S=Vv(i,t.grid,c,e.charDefs,l,n);S.group.position.y=s,r.add(S.group);const b=W_(i);b.group.position.y=s,r.add(b.group);for(const ct of b.meshMap.values())o.push(ct);const x=X_(i);x.group.position.y=s,r.add(x.group);const P=qv(i);P.group.position.y=s,r.add(P.group);const T=Y_(i);T.group.position.y=s,r.add(T.group);const C=ox(i);C.group.position.y=s,r.add(C.group);const R=_v(i);R.group.position.y=s,r.add(R.group);const y=fx(i);y.group.position.y=s,r.add(y.group);const v=vv(i);v.group.position.y=s,r.add(v.group);const A=gx(i);A.group.position.y=s,r.add(A.group);const H=xv(i);H.group.position.y=s,r.add(H.group);const L=vx(i);L.group.position.y=s,r.add(L.group);const z=sv(i);z.group.position.y=s,r.add(z.group);const $=tv(t.grid,e.charDefs);$.instances.length>0&&($.group.position.y=s,r.add($.group),a.push(...$.instances));const W=yv(i.npcs);W.group.position.y=s,r.add(W.group);for(const ct of W.meshMap.values())o.push(ct);const Z=iv(i);Z.group.position.y=s,r.add(Z.group);for(const ct of Z.meshMap.values())o.push(ct);const N=cv(i);N.group.position.y=s,r.add(N.group);for(const ct of N.meshMap.values())o.push(ct);const at=uv(i);at.group.position.y=s,r.add(at.group);for(const ct of at.meshMap.values())o.push(ct);return{group:r,billboardMeshes:o,forestInstances:a}}function XM(i,t,e,n,s,r){var C,R,y;const o=e.yOffset??t*Se,a=e.defaults??n.defaults,c=e.areas??n.areas,u=t===s-1?(e.ceiling??n.ceiling)!==!1:!0,f=zr(n.charDefs),d=new Set(i.stairs.keys()),m=new Set;for(const v of i.breakableWalls.keys())m.add(v);for(const v of i.secretWalls.keys())m.add(v);const{rampOpenCells:p,rampHalfWalls:_}=xx(i,t),g=new Map;if(t+1<s){const v=i.activeLayerIndex;i.activeLayerIndex=t+1;for(const[,A]of i.pitTraps){if(A.state!=="open")continue;const{col:H,row:L}=A;L>=0&&L<e.grid.length&&H>=0&&H<e.grid[0].length&&(f.has(e.grid[L][H])||g.set(X(H,L),{}))}i.activeLayerIndex=v}const h=new Set;if(t+2<s){const v=i.activeLayerIndex;i.activeLayerIndex=t+2;const A=(C=n.layers[t+1])==null?void 0:C.grid;for(const[,H]of i.pitTraps){const{col:L,row:z}=H;!A||z>=A.length||L>=A[0].length||f.has(A[z][L])||h.add(X(L,z))}i.activeLayerIndex=v}const S=(R=n.layers[t+1])==null?void 0:R.grid,b=(y=n.layers[t-1])==null?void 0:y.grid,{group:x,pitFloorMap:P,pitCeilingMap:T}=T_(e.grid,a,c,n.charDefs,u,d,m,r==null?void 0:r.envZoneMap,r==null?void 0:r.doorCells,S,b,p,_,r==null?void 0:r.pitTrapCells,g.size>0?g:void 0,h.size>0?h:void 0);for(const[v,A]of i.pitTraps)if(A.state==="open"){const H=P.get(v);H&&(H.visible=!1)}if(t+2<s){const v=i.activeLayerIndex;i.activeLayerIndex=t+2;for(const[,A]of i.pitTraps)if(A.state==="open"){const H=T.get(X(A.col,A.row));H&&(H.visible=!1)}i.activeLayerIndex=v}return x.position.y=o,{group:x,pitFloorMap:P,pitCeilingMap:T}}const Mx=20,uu=.05,hu=.95,fu=.35,du=.15,yx=3,Pa=20,vh=2*Se,Sx=Pa*Pa/(2*vh),wx=-.4,bx=.667;class YM{constructor(t,e,n,s,r,o,a,c,l,u,f){it(this,"camera");it(this,"grid");it(this,"state");it(this,"currentPos");it(this,"targetPos");it(this,"currentAngle");it(this,"targetAngle");it(this,"currentPitch");it(this,"targetPitch");it(this,"onMoveCallback");it(this,"onMoveBlocked");it(this,"onTurnCallback");it(this,"onFallLandCallback");it(this,"commandQueue",[]);it(this,"slowMultiplier",1);it(this,"yOffset",0);it(this,"targetYOffset",0);it(this,"debugNoClip",!1);it(this,"isFalling",!1);it(this,"fallVelocity",0);it(this,"fallDistance",0);it(this,"fallTargetYOffset",0);it(this,"fallLandingLayer",0);it(this,"pendingFall",null);it(this,"moveStartPos",null);it(this,"moveStartDist",0);it(this,"stairs");this.camera=t,this.grid=e,this.stairs=l,this.state=new z0(n,s,r,o,a,c,u,f);const d=this.gridToWorld(n,s);this.currentPos=d.clone(),this.targetPos=d.clone(),this.currentAngle=gc[r],this.targetAngle=this.currentAngle,this.currentPitch=this.pitchForCell(n,s),this.targetPitch=this.currentPitch,t.rotation.order="YXZ",t.position.copy(this.currentPos),t.rotation.y=this.currentAngle,t.rotation.x=this.currentPitch}gridToWorld(t,e){var r;let n=y_;const s=(r=this.stairs)==null?void 0:r.get(X(t,e));return(s==null?void 0:s.direction)==="down"&&(n-=fu),(s==null?void 0:s.direction)==="up"&&(n+=fu),new k(t*I+I/2,n,e*I+I/2)}pitchForCell(t,e){var s;const n=(s=this.stairs)==null?void 0:s.get(X(t,e));return(n==null?void 0:n.direction)==="down"?-du:(n==null?void 0:n.direction)==="up"?du:0}isAnimating(){return this.isFalling||this.pendingFall!==null||this.currentPos.distanceTo(this.targetPos)>uu||Math.abs(this.currentAngle-this.targetAngle)>uu}getState(){return this.state}teleport(t,e,n){this.state.col=t,this.state.row=e,this.state.facing=n;const s=this.gridToWorld(t,e);this.currentPos.copy(s),this.targetPos.copy(s),this.currentAngle=gc[n],this.targetAngle=this.currentAngle,this.currentPitch=0,this.targetPitch=0,this.commandQueue=[]}setOnMove(t){this.onMoveCallback=t}setOnMoveBlocked(t){this.onMoveBlocked=t}setOnTurn(t){this.onTurnCallback=t}setOnFallLand(t){this.onFallLandCallback=t}setPendingFall(t,e){this.pendingFall={landingLayer:t,totalDistance:e}}get falling(){return this.isFalling||this.pendingFall!==null}debugMove(t,e){const n=this.state.col+t,s=this.state.row+e;return s<0||s>=this.grid.length||n<0||n>=this.grid[0].length?!1:(this.state.col=n,this.state.row=s,!0)}trackMoveStart(){this.moveStartPos=this.currentPos.clone(),this.moveStartDist=this.moveStartPos.distanceTo(this.targetPos)}moveForward(){var s,r;if(this.isAnimating()){this.enqueue(()=>this.moveForward());return}const[t,e]=Oe[this.state.facing];(this.debugNoClip?this.debugMove(t,e):this.state.moveForward(this.grid))?(this.targetPos.copy(this.gridToWorld(this.state.col,this.state.row)),this.targetPitch=this.pitchForCell(this.state.col,this.state.row),this.trackMoveStart(),(s=this.onMoveCallback)==null||s.call(this,this.state.col,this.state.row)):this.debugNoClip||(r=this.onMoveBlocked)==null||r.call(this,this.state.col+t,this.state.row+e,t,e,()=>this.moveForward())}moveBack(){var s,r;if(this.isAnimating()){this.enqueue(()=>this.moveBack());return}const[t,e]=Oe[this.state.facing];(this.debugNoClip?this.debugMove(-t,-e):this.state.moveBack(this.grid))?(this.targetPos.copy(this.gridToWorld(this.state.col,this.state.row)),this.targetPitch=this.pitchForCell(this.state.col,this.state.row),this.trackMoveStart(),(s=this.onMoveCallback)==null||s.call(this,this.state.col,this.state.row)):this.debugNoClip||(r=this.onMoveBlocked)==null||r.call(this,this.state.col-t,this.state.row-e,-t,-e,()=>this.moveBack())}strafeLeft(){var s,r;if(this.isAnimating()){this.enqueue(()=>this.strafeLeft());return}const[t,e]=Oe[Sa[this.state.facing]];(this.debugNoClip?this.debugMove(t,e):this.state.strafeLeft(this.grid))?(this.targetPos.copy(this.gridToWorld(this.state.col,this.state.row)),this.targetPitch=this.pitchForCell(this.state.col,this.state.row),this.trackMoveStart(),(s=this.onMoveCallback)==null||s.call(this,this.state.col,this.state.row)):this.debugNoClip||(r=this.onMoveBlocked)==null||r.call(this,this.state.col+t,this.state.row+e,t,e,()=>this.strafeLeft())}strafeRight(){var s,r;if(this.isAnimating()){this.enqueue(()=>this.strafeRight());return}const[t,e]=Oe[wa[this.state.facing]];(this.debugNoClip?this.debugMove(t,e):this.state.strafeRight(this.grid))?(this.targetPos.copy(this.gridToWorld(this.state.col,this.state.row)),this.targetPitch=this.pitchForCell(this.state.col,this.state.row),this.trackMoveStart(),(s=this.onMoveCallback)==null||s.call(this,this.state.col,this.state.row)):this.debugNoClip||(r=this.onMoveBlocked)==null||r.call(this,this.state.col+t,this.state.row+e,t,e,()=>this.strafeRight())}turnLeft(){var t;if(this.isAnimating()){this.enqueue(()=>this.turnLeft());return}this.state.turnLeft(),this.targetAngle+=Math.PI/2,(t=this.onTurnCallback)==null||t.call(this)}turnRight(){var t;if(this.isAnimating()){this.enqueue(()=>this.turnRight());return}this.state.turnRight(),this.targetAngle-=Math.PI/2,(t=this.onTurnCallback)==null||t.call(this)}enqueue(t){this.commandQueue.length<yx&&this.commandQueue.push(t)}update(t){var n;const e=Math.min(1,Mx/this.slowMultiplier*t);if(this.currentPos.lerp(this.targetPos,e),this.currentPos.distanceTo(this.targetPos)<.005&&this.currentPos.copy(this.targetPos),this.currentAngle+=(this.targetAngle-this.currentAngle)*e,Math.abs(this.currentAngle-this.targetAngle)<.005&&(this.currentAngle=this.targetAngle),this.currentPitch+=(this.targetPitch-this.currentPitch)*e,Math.abs(this.currentPitch-this.targetPitch)<.005&&(this.currentPitch=this.targetPitch),this.pendingFall&&this.moveStartPos&&this.moveStartDist>0&&1-this.currentPos.distanceTo(this.targetPos)/this.moveStartDist>=bx&&(this.isFalling=!0,this.fallVelocity=0,this.fallDistance=0,this.fallTargetYOffset=this.pendingFall.landingLayer*Se,this.fallLandingLayer=this.pendingFall.landingLayer,this.targetPitch=wx,this.commandQueue=[],this.pendingFall=null,this.moveStartPos=null),this.isFalling){this.fallDistance<vh&&(this.fallVelocity=Math.min(this.fallVelocity+Sx*t,Pa));const s=this.fallVelocity*t;this.yOffset-=s,this.fallDistance+=s,this.yOffset<=this.fallTargetYOffset&&(this.yOffset=this.fallTargetYOffset,this.targetYOffset=this.fallTargetYOffset,this.isFalling=!1,this.fallVelocity=0,this.fallDistance=0,this.targetPitch=0,(n=this.onFallLandCallback)==null||n.call(this,this.fallLandingLayer))}else this.yOffset+=(this.targetYOffset-this.yOffset)*e,Math.abs(this.yOffset-this.targetYOffset)<.005&&(this.yOffset=this.targetYOffset);this.camera.position.copy(this.currentPos),this.camera.position.y+=this.yOffset,this.camera.position.x+=Math.sin(this.currentAngle)*hu,this.camera.position.z+=Math.cos(this.currentAngle)*hu,this.camera.rotation.y=this.currentAngle,this.camera.rotation.x=this.currentPitch,!this.isFalling&&!this.isAnimating()&&this.commandQueue.length>0&&this.commandQueue.shift()()}getWorldPosition(){return this.currentPos.clone()}switchGrid(t,e,n){this.grid=t,this.stairs=n,this.state.setWalkable(e)}}const Ex=180;function Tx(){const t=document.createElement("canvas");t.width=1024,t.height=1024;const e=t.getContext("2d"),n=e.createLinearGradient(0,0,0,1024);n.addColorStop(0,"#01010a"),n.addColorStop(1,"#03030e"),e.fillStyle=n,e.fillRect(0,0,1024,1024);const s=1200;for(let o=0;o<s;o++){const a=Math.random()*1024,c=Math.random()*1024,l=.3+Math.random()*.7,u=150+Math.floor(Math.random()*105);e.fillStyle=`rgb(${u}, ${u}, ${Math.min(255,u+20)})`,e.beginPath(),e.arc(a,c,l,0,Math.PI*2),e.fill()}const r=new Qe(t);return r.magFilter=Nt,r.minFilter=Nt,r}function Ax(){const t=document.createElement("canvas");t.width=1024,t.height=1024;const e=t.getContext("2d"),n=e.createLinearGradient(0,0,0,1024);n.addColorStop(0,"#3366aa"),n.addColorStop(.4,"#5588cc"),n.addColorStop(.7,"#88bbdd"),n.addColorStop(1,"#aaccee"),e.fillStyle=n,e.fillRect(0,0,1024,1024),e.fillStyle="rgba(255, 255, 255, 0.3)";for(let r=0;r<25;r++){const o=Math.random()*1024,a=1024*.1+Math.random()*1024*.5,c=30+Math.random()*60,l=10+Math.random()*20;e.beginPath(),e.ellipse(o,a,c,l,0,0,Math.PI*2),e.fill()}const s=new Qe(t);return s.magFilter=Nt,s.minFilter=Nt,s}function Rx(){const t=document.createElement("canvas");t.width=1024,t.height=1024;const e=t.getContext("2d"),n=e.createLinearGradient(0,0,0,1024);n.addColorStop(0,"#1a2244"),n.addColorStop(.3,"#443366"),n.addColorStop(.5,"#cc6633"),n.addColorStop(.7,"#ee8866"),n.addColorStop(1,"#ffaa88"),e.fillStyle=n,e.fillRect(0,0,1024,1024),e.fillStyle="rgba(255, 200, 150, 0.25)";for(let r=0;r<20;r++){const o=Math.random()*1024,a=1024*.15+Math.random()*1024*.4,c=25+Math.random()*50,l=8+Math.random()*15;e.beginPath(),e.ellipse(o,a,c,l,0,0,Math.PI*2),e.fill()}const s=new Qe(t);return s.magFilter=Nt,s.minFilter=Nt,s}function qM(i="starry-night"){let t;switch(i){case"daylight":t=Ax();break;case"sunset":t=Rx();break;default:t=Tx();break}const e=new is(Ex,32,16),n=new es({map:t,side:Be,fog:!1,depthWrite:!1}),s=new tt(e,n);return s.renderOrder=-1,s}export{Ea as $,rl as A,De as B,Ox as C,Cn as D,ht as E,Oe as F,Dt as G,br as H,Gx as I,Qe as J,Xu as K,Br as L,Bx as M,Nt as N,ve as O,I0 as P,es as Q,Pe as R,Hx as S,pc as T,Nu as U,k as V,Rt as W,kx as X,Ux as Y,tt as Z,Jx as _,fe as a,EM as a$,Rr as a0,Se as a1,NM as a2,Er as a3,FM as a4,XM as a5,H_ as a6,As as a7,iM as a8,W_ as a9,YM as aA,Fx as aB,Px as aC,Ze as aD,Ix as aE,Vx as aF,Nx as aG,Zi as aH,mM as aI,VM as aJ,CM as aK,SM as aL,rM as aM,DM as aN,sM as aO,D_ as aP,Wa as aQ,vM as aR,oM as aS,fM as aT,OM as aU,cM as aV,uM as aW,BM as aX,HM as aY,GM as aZ,aM as a_,X_ as aa,Y_ as ab,qv as ac,J_ as ad,Lv as ae,tv as af,ox as ag,Dv as ah,dv as ai,_v as aj,fx as ak,vv as al,gx as am,xv as an,bv as ao,Uv as ap,Vv as aq,wv as ar,vx as as,sv as at,yv as au,iv as av,qu as aw,cv as ax,uv as ay,qM as az,bM as b,TM as b0,hM as b1,mh as b2,Cc as b3,zM as b4,tM as b5,LM as b6,_M as b7,WM as b8,pM as b9,A_ as bA,R_ as bB,C_ as bC,O_ as bD,F_ as bE,Qx as bF,AM as ba,RM as bb,lM as bc,dM as bd,UM as be,xM as bf,qx as bg,U_ as bh,f_ as bi,gM as bj,MM as bk,Sa as bl,wa as bm,kM as bn,jx as bo,Zx as bp,an as bq,$M as br,gc as bs,ri as bt,Is as bu,Hr as bv,Ya as bw,Kx as bx,yc as by,PM as bz,wM as c,X as d,Pn as e,nM as f,Yx as g,mc as h,k0 as i,$x as j,ji as k,In as l,yM as m,zx as n,x_ as o,Wx as p,I as q,IM as r,kt as s,eM as t,Le as u,Dx as v,Xx as w,T0 as x,zr as y,Lx as z};
