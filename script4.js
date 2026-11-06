
(function(){
  function startHomeBackgroundVideo(){
    var video=document.getElementById('homeBackgroundVideo');
    if(!video) return;
    video.muted=true;
    video.defaultMuted=true;
    video.volume=0;
    video.setAttribute('muted','');
    video.setAttribute('autoplay','');
    video.setAttribute('playsinline','');
    video.setAttribute('webkit-playsinline','');
    video.setAttribute('disablepictureinpicture','');
    var playNow=function(){
      try { var attempt=video.play(); if(attempt && typeof attempt.catch==='function') attempt.catch(function(){}); } catch(e) {}
    };
    playNow();
    setTimeout(playNow,100);
    setTimeout(playNow,500);
    setTimeout(playNow,1200);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startHomeBackgroundVideo);
  else startHomeBackgroundVideo();
  window.addEventListener('pageshow',startHomeBackgroundVideo);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) startHomeBackgroundVideo(); });
  var v=document.getElementById('homeBackgroundVideo');
  if(v){ ['loadedmetadata','canplay','canplaythrough','loadeddata'].forEach(function(evt){ v.addEventListener(evt,startHomeBackgroundVideo,{passive:true}); }); }
})();
