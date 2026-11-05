# Deploy on Vultr

1. Cloud Compute, Shared CPU, Ubuntu 24.04, 1 vCPU / 1 GB plan (2 GB if the build runs out of memory), any nearby region.
2. Paste `user-data.sh` into Cloud-Init User-Data, deploy, wait about 5 minutes.
3. Open `http://<server-ip>/`.
4. Turn on Vultr Serverless Inference: SSH in, then
   `echo 'VULTR_INFERENCE_API_KEY=<key>' | sudo tee /etc/prove-it.env && sudo systemctl restart prove-it`.
   Without a key the built-in rule parser is used.

Update later: re-run `sudo bash /opt/prove-it/deploy/user-data.sh`.
