#!/bin/bash

# Backend Deployment Script for EC2
# Usage: ./deploy.sh

set -e  # Exit on any error

# Configuration
EC2_HOST="ec2-107-21-169-6.compute-1.amazonaws.com"
EC2_USER="ec2-user"
PEM_FILE="$HOME/visio/bala_visio_backend.pem"
DEPLOY_PATH="/var/www/visio-backend"
ARCHIVE_NAME="visio-backend.tar.gz"
PM2_PROCESS="visio-backend"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting backend deployment to EC2...${NC}\n"

# Step 1: Build the application
echo -e "${YELLOW}[1/8] Building application...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build completed${NC}\n"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Step 2: Create deployment archive
echo -e "${YELLOW}[2/8] Creating deployment archive...${NC}"
tar -czf /tmp/$ARCHIVE_NAME \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=src \
    --exclude=tests \
    --exclude=.env \
    --exclude=.env.* \
    dist package*.json
echo -e "${GREEN}✓ Archive created: /tmp/$ARCHIVE_NAME${NC}\n"

# Step 3: Transfer archive to EC2
echo -e "${YELLOW}[3/8] Transferring archive to EC2...${NC}"
scp -i "$PEM_FILE" /tmp/$ARCHIVE_NAME $EC2_USER@$EC2_HOST:/tmp/
echo -e "${GREEN}✓ Transfer completed${NC}\n"

# Step 4: Create backup on EC2
echo -e "${YELLOW}[4/8] Creating backup on EC2...${NC}"
BACKUP_NAME=$(ssh -i "$PEM_FILE" $EC2_USER@$EC2_HOST \
    'TIMESTAMP=$(date +%Y%m%d%H%M%S) && sudo cp -r /var/www/visio-backend /var/www/visio-backend.backup.$TIMESTAMP && echo "visio-backend.backup.$TIMESTAMP"')
echo -e "${GREEN}✓ Backup created: $BACKUP_NAME${NC}\n"

# Step 5: Extract files on EC2
echo -e "${YELLOW}[5/8] Extracting files on EC2...${NC}"
ssh -i "$PEM_FILE" $EC2_USER@$EC2_HOST \
    "cd $DEPLOY_PATH && sudo tar -xzf /tmp/$ARCHIVE_NAME && sudo chown -R ec2-user:ec2-user $DEPLOY_PATH"
echo -e "${GREEN}✓ Files extracted${NC}\n"

# Step 6: Install dependencies on EC2
echo -e "${YELLOW}[6/8] Installing dependencies on EC2...${NC}"
ssh -i "$PEM_FILE" $EC2_USER@$EC2_HOST \
    "cd $DEPLOY_PATH && npm install --omit=dev && npm install tsconfig-paths" > /dev/null 2>&1
echo -e "${GREEN}✓ Dependencies installed${NC}\n"

# Step 7: Restart/Start PM2 process with bootstrap entry
echo -e "${YELLOW}[7/8] Restarting PM2 process...${NC}"
ssh -i "$PEM_FILE" $EC2_USER@$EC2_HOST "pm2 describe $PM2_PROCESS >/dev/null 2>&1 || pm2 start $DEPLOY_PATH/dist/bootstrap.js --name $PM2_PROCESS && pm2 restart $PM2_PROCESS && pm2 save" | grep -E "(visio-backend|status|online)"
echo -e "${GREEN}✓ PM2 process running${NC}\n"

# Step 8: Verify deployment
echo -e "${YELLOW}[8/8] Verifying deployment...${NC}"
sleep 5
HEALTH_CHECK=$(curl -s http://$EC2_HOST/api/v1/health)
if echo "$HEALTH_CHECK" | grep -q "success"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$HEALTH_CHECK" | jq '.' 2>/dev/null || echo "$HEALTH_CHECK"
else
    echo -e "${RED}✗ Health check failed${NC}"
    exit 1
fi

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
ssh -i "$PEM_FILE" $EC2_USER@$EC2_HOST "rm -f /tmp/$ARCHIVE_NAME"
rm -f /tmp/$ARCHIVE_NAME
ssh -i "$PEM_FILE" $EC2_USER@$EC2_HOST "pm2 save" > /dev/null 2>&1
echo -e "${GREEN}✓ Cleanup completed${NC}\n"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Backend URL: ${YELLOW}http://$EC2_HOST/api/v1${NC}"
echo -e "Backup: ${YELLOW}$BACKUP_NAME${NC}"
