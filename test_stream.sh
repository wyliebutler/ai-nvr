#!/bin/bash
ffmpeg -v debug -rtsp_transport tcp -i "rtsp://wyliebutler:ler542111@192.168.2.51:554/stream1" -t 5 -f null - 2>&1
