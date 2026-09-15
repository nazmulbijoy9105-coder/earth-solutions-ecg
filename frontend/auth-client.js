'use strict';
var EarthAuth={
getToken:function(){return localStorage.getItem('es_token')},
setToken:function(t){localStorage.setItem('es_token',t)},
clearToken:function(){localStorage.removeItem('es_token');localStorage.removeItem('es_user')},
getUser:function(){try{return JSON.parse(localStorage.getItem('es_user'))}catch{return null}},
setUser:function(u){localStorage.setItem('es_user',JSON.stringify(u))},
getSession:function(){var t=this.getToken(),u=this.getUser();return t&&u?{token:t,user:u}:null},
isLoggedIn:function(){return!!this.getToken()},
isAdmin:function(){var u=this.getUser();return u&&u.role==='admin'},
register:async function(name,email,password,role){var r=await fetch('/api/user/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,email:email,password:password,role:role||'user'})});var d=await r.json();if(!r.ok)throw new Error(d.error||'Registration failed');this.setToken(d.token);this.setUser(d.user);return d},
login:async function(email,password){var r=await fetch('/api/user/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:password})});var d=await r.json();if(!r.ok)throw new Error(d.error||'Login failed');this.setToken(d.token);this.setUser(d.user);return d},
logout:async function(){var t=this.getToken();this.clearToken();if(t){try{await fetch('/api/user/logout',{method:'POST',headers:{'Authorization':'Bearer '+t}})}catch(_){}}},
getProfile:async function(){var t=this.getToken();if(!t)throw new Error('Not logged in');var r=await fetch('/api/user/profile',{headers:{'Authorization':'Bearer '+t}});if(!r.ok){this.clearToken();throw new Error('Session expired')}return await r.json()},
updateProfile:async function(name){var t=this.getToken();var r=await fetch('/api/user/profile',{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({name:name})});var d=await r.json();if(!r.ok)throw new Error(d.error||'Update failed');this.setUser(d);return d},
getInitials:function(name){if(!name)return'U';return name.split(' ').map(function(n){return n[0]}).join('').toUpperCase()}
};
