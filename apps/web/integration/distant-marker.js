/** A finding-chart point preserves visibility when a body's real disc is smaller than a pixel. */
export function distantMarker(radiusPixels,distance,height,fov){
 if(!(distance>0&&height>0)||!Number.isFinite(radiusPixels)||radiusPixels>=3)return {visible:false,scale:0,opacity:0};
 return {visible:true,scale:10*distance*2*Math.tan(fov*Math.PI/360)/height,opacity:Math.min(1,Math.max(0,(3-radiusPixels)/3))};
}
