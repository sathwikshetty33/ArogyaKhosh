pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = "your-registry.io"
        BACKEND_IMAGE = "${DOCKER_REGISTRY}/django-backend"
        ML_IMAGE = "${DOCKER_REGISTRY}/flask-ml"
        FRONTEND_IMAGE = "${DOCKER_REGISTRY}/react-frontend"
        VERSION = "${BUILD_NUMBER}"
        KUBECONFIG = credentials('kubeconfig')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build Images') {
            parallel {
                stage('Build Backend') {
                    steps {
                        dir('backend') {
                            sh "docker build -t ${BACKEND_IMAGE}:${VERSION} -t ${BACKEND_IMAGE}:latest ."
                        }
                    }
                }
                
                stage('Build ML Service') {
                    steps {
                        dir('ml-service') {
                            sh "docker build -t ${ML_IMAGE}:${VERSION} -t ${ML_IMAGE}:latest ."
                        }
                    }
                }
                
                stage('Build Frontend') {
                    steps {
                        dir('frontend') {
                            sh "docker build -t ${FRONTEND_IMAGE}:${VERSION} -t ${FRONTEND_IMAGE}:latest ."
                        }
                    }
                }
            }
        }
        
        stage('Run Tests') {
            parallel {
                stage('Test Backend') {
                    steps {
                        dir('backend') {
                            sh "docker run --rm ${BACKEND_IMAGE}:${VERSION} python manage.py test"
                        }
                    }
                }
                
                stage('Test ML Service') {
                    steps {
                        dir('ml-service') {
                            sh "docker run --rm ${ML_IMAGE}:${VERSION} python -m pytest"
                        }
                    }
                }
                
                stage('Test Frontend') {
                    steps {
                        dir('frontend') {
                            sh "docker run --rm ${FRONTEND_IMAGE}:${VERSION} npm test -- --watchAll=false"
                        }
                    }
                }
            }
        }
        
        stage('Push Images') {
            steps {
                withCredentials([string(credentialsId: 'docker-registry-credentials', variable: 'DOCKER_CREDS')]) {
                    sh "echo ${DOCKER_CREDS} | docker login ${DOCKER_REGISTRY} -u jenkins --password-stdin"
                    sh "docker push ${BACKEND_IMAGE}:${VERSION}"
                    sh "docker push ${BACKEND_IMAGE}:latest"
                    sh "docker push ${ML_IMAGE}:${VERSION}"
                    sh "docker push ${ML_IMAGE}:latest"
                    sh "docker push ${FRONTEND_IMAGE}:${VERSION}"
                    sh "docker push ${FRONTEND_IMAGE}:latest"
                }
            }
        }
        
        stage('Update Kubernetes Manifests') {
            steps {
                sh """
                    sed -i 's|image: ${BACKEND_IMAGE}:.*|image: ${BACKEND_IMAGE}:${VERSION}|' kubernetes/backend-deployment.yaml
                    sed -i 's|image: ${ML_IMAGE}:.*|image: ${ML_IMAGE}:${VERSION}|' kubernetes/ml-deployment.yaml
                    sed -i 's|image: ${FRONTEND_IMAGE}:.*|image: ${FRONTEND_IMAGE}:${VERSION}|' kubernetes/frontend-deployment.yaml
                """
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                sh """
                    export KUBECONFIG=${KUBECONFIG}
                    kubectl apply -f kubernetes/namespace.yaml
                    kubectl apply -f kubernetes/backend-deployment.yaml
                    kubectl apply -f kubernetes/backend-service.yaml
                    kubectl apply -f kubernetes/ml-deployment.yaml
                    kubectl apply -f kubernetes/ml-service.yaml
                    kubectl apply -f kubernetes/frontend-deployment.yaml
                    kubectl apply -f kubernetes/frontend-service.yaml
                """
            }
        }
    }
    
    post {
        always {
            sh "docker rmi ${BACKEND_IMAGE}:${VERSION} ${ML_IMAGE}:${VERSION} ${FRONTEND_IMAGE}:${VERSION} || true"
        }
        success {
            echo 'Deployment completed successfully!'
        }
        failure {
            echo 'Deployment failed!'
        }
    }
}