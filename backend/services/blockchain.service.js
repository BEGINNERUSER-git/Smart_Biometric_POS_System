import axios from "axios";
import fs from "fs";
import path from "path";

const MODE=process.env.BLOCKCHAIN_MODE || "stub";

let fabricService=false;
let fabricsdk;

if(MODE==="fabric"){
    try {
        fabricsdk=await import ("fabric-network");
        fabricService=true;
    } catch (error) {

        console.error("Failed to load fabric-sdk:", error);
        fabricService=false;
        
    }
}

