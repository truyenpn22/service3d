import * as THREE from 'three';
import { OrbitControls } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/controls/OrbitControls.js';
import { TextGeometry } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/loaders/FontLoader.js';
import { OutlinePass } from 'https://unpkg.com/three@0.140.0/examples/jsm/postprocessing/OutlinePass.js';
import { EffectComposer } from 'https://unpkg.com/three@0.140.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.140.0/examples/jsm/postprocessing/RenderPass.js';
import { GLTFLoader } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/loaders/GLTFLoader.js';


class NetWordChart {
    constructor(config) {
        this.config = config;
        this.initializeChart();
    }
    initializeChart() {

        const classId = this.config.classId || "network-graph";
        const data = this.config.data || [];
        const rotationY = this.config.rotationY || 0.002;
        let serviceNodes, tableNodes, mixer;
        let isClicked = false;
        let globalRotation = 0;
        let isRotating = false;
        let connectingLines = [];
        let lastUpdateTime = Date.now();
        let isControlChange = false;
        let isDraggingControls = false;
        let fontUrl = "https://unpkg.com/three@0.77.0/examples/fonts/helvetiker_bold.typeface.json";

        // ==============================================================

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 11;

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();


        const renderer = new THREE.WebGLRenderer({
            antialias: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.5;
        controls.enablePan = false;
        controls.minDistance = 10;
        controls.maxDistance = 2000;

        const allNodesGroupDetails = new THREE.Group();
        const allNodesGroup = new THREE.Group();


        document.getElementById(classId).appendChild(renderer.domElement);

        // ==============================================================
        const loader = new FontLoader();


        const colors = d3.scaleOrdinal(d3.schemeCategory10);


        scene.fog = new THREE.FogExp2(0xD8D9DA, 0.05);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();



        window.addEventListener('resize', onWindowResize);
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
        // ===============================================================


        function extractNodesAndLinks(data) {
            let nodes = [];
            let links = [];


            data.webServices.forEach(service => {
                let serviceNode = nodes.find(node => node.id === service.id);

                if (!serviceNode) {
                    serviceNode = {
                        id: service.id,
                        name: service.name,
                        type: "service"
                    };
                    nodes.push(serviceNode);
                }


                service.relatedTables.forEach(table => {
                    let tableNode = nodes.find(node => node.id === table.id);

                    if (!tableNode) {
                        tableNode = {
                            id: table.id,
                            name: table.name,
                            count: table.count,
                            type: "table"
                        };
                        nodes.push(tableNode);
                    }

                    const linkExists = links.some(link => link.source === serviceNode.id && link.target === tableNode.id);

                    if (!linkExists) {
                        links.push({
                            source: serviceNode.id,
                            target: tableNode.id
                        });
                    }
                });
            });

            return { nodes, links };
        };

        // ==============================================================



        function createVisualNodesAndLinks(nodes, links) {
            const totalNodes = nodes.length;
            const maxRadius = 5;
            const minRadius = 3;
            const sphereRadius = Math.max(minRadius, Math.min(maxRadius, totalNodes / 10));
            nodes.forEach((node, index) => {
                const phi = Math.acos(1 - (2 * index + 1) / totalNodes);
                const goldenRatio = (1 + Math.sqrt(5)) / 2;
                const theta = 2 * Math.PI * (index + 0.5) / goldenRatio;

                if (node.type === 'service') {
                    const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
                    const y = sphereRadius * Math.cos(phi);
                    const z = sphereRadius * Math.sin(theta) * Math.sin(phi);
                    const geometry = new THREE.SphereGeometry(0.35, 18, 10);
                    const labelCanvas = document.createElement('canvas');
                    const labelContext = labelCanvas.getContext('2d');
                    const text = node.name.toUpperCase();
                    const textWidth = labelContext.measureText(text).width;
                    const textX = labelCanvas.width / 3.5 - textWidth / 1;
                    const textY = labelCanvas.height / 2 + 5;
                    labelContext.save();
                    labelContext.fillStyle = colors(node.id);
                    labelContext.font = 'bold 21px Arial';
                    labelContext.filter = "contrast(2)";
                    labelContext.filter = "contrast(2)";
                    labelContext.textBaseline = 'middle';
                    labelContext.fillText(text, textX, textY);
                    labelContext.rotate(Math.PI / 2);
                    labelContext.restore();
                    const texture = new THREE.CanvasTexture(labelCanvas);
                    const material = new THREE.MeshBasicMaterial({ map: texture });
                    const sphere = new THREE.Mesh(geometry, material);
                    sphere.position.set(x, y, z);
                    node.sphere = sphere;
                    allNodesGroup.add(sphere);

                    const cylinderGeometry = new THREE.CylinderGeometry(0.37, 0.37, 0.02, 14);
                    cylinderGeometry.rotateX(Math.PI / 2);
                    const cylinderMaterial = new THREE.MeshBasicMaterial({ color: colors(node.id) });
                    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
                    cylinder.position.set(x, y, z);
                    allNodesGroup.add(cylinder);
                    node.cylinder = cylinder;
                    scene.add(allNodesGroup)

                    sphere.onClick = function () {
                        this.userData.isSelected = !this.userData.isSelected;
                        if (this.userData.isSelected) {
                            const shadowGeometry = new THREE.SphereGeometry(0.45, 18, 10);
                            shadowGeometry.rotateX(Math.PI / 2);
                            const shadowMaterial = new THREE.MeshBasicMaterial({
                                color: colors(node.id),
                                transparent: true,
                                opacity: 0.5,
                            });
                            const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
                            allNodesGroup.add(shadowMesh);
                            this.userData.shadowMesh = shadowMesh;
                            scene.add(allNodesGroup)
                            this.userData.connectedLines = []

                            links.forEach((link) => {
                                if (link.source === node.id) {
                                    const targetNode = nodes.find(n => n.id === link.target);
                                    if (targetNode && targetNode.type === 'table') {
                                        const targetPosition = targetNode.sphere.position;
                                        const distance = this.position.distanceTo(targetPosition);
                                        const geometry = new THREE.CylinderGeometry(0.05, 0.05, distance, 18);
                                        const material = new THREE.MeshBasicMaterial({
                                            color: new THREE.Color(colors(node.id)),
                                        });
                                        const line = new THREE.Mesh(geometry, material);
                                        connectingLines.push(line);

                                        const direction = new THREE.Vector3().subVectors(targetPosition, this.position);
                                        const midpoint = new THREE.Vector3().addVectors(this.position, direction.multiplyScalar(0.5));
                                        line.position.copy(midpoint);

                                        const axis = new THREE.Vector3(0, 1, 0);
                                        line.quaternion.setFromUnitVectors(axis, direction.clone().normalize());
                                        allNodesGroup.add(line);
                                        scene.add(allNodesGroup)

                                        this.userData.connectedLines.push(line);

                                        const shadowGeometry = new THREE.SphereGeometry(0.26, 18, 12);
                                        shadowGeometry.rotateX(Math.PI / 2);
                                        const shadowMaterial = new THREE.MeshBasicMaterial({
                                            color: colors(targetNode.id),
                                            transparent: true,
                                            opacity: 0.5,
                                        });
                                        const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
                                        shadowMesh.position.copy(targetPosition);
                                        allNodesGroup.add(shadowMesh);
                                        scene.add(allNodesGroup)
                                        targetNode.sphere.userData.shadowMesh = shadowMesh;
                                    }
                                }
                            });

                            if (!isRotating) {

                                isRotating = true;
                                const rotateDuration = 5000;
                                const rotateAngle = (Math.PI * 2) - 0.4;
                                const framesPerRotation = 1000;
                                const rotationIncrement = rotateAngle / framesPerRotation;

                                const rotateInterval = setInterval(() => {
                                    if (globalRotation >= rotateAngle) {
                                        clearInterval(rotateInterval);
                                        isRotating = false;
                                        globalRotation = 0;
                                        document.body.style.cursor = 'default'
                                        this.userData.isSelected = !this.userData.isSelected;
                                        isClicked = true;
                                        scene.fog = new THREE.FogExp2(0x000000, 0);

                                        allNodesGroup.children.filter((other) => other.name === "link").forEach((n) => { n.material.visible = false; });
                                        allNodesGroup.visible = false
                                        allNodesGroupDetails.visible = true

                                        const newGeometry = new THREE.SphereGeometry(0.8, 18, 10);
                                        const CylinderGeometry = new THREE.CylinderGeometry(0.85, 0.5, 0.12, 18);
                                        CylinderGeometry.rotateX(Math.PI / 2);
                                        const CylinderGeometryMaterial = new THREE.MeshBasicMaterial({ color: colors(node.id), });
                                        const CylinderGeometryMesh = new THREE.Mesh(CylinderGeometry, CylinderGeometryMaterial);
                                        allNodesGroupDetails.add(CylinderGeometryMesh);

                                        const shadowGeometry = new THREE.CylinderGeometry(1, 1, 0.12, 18);
                                        shadowGeometry.rotateX(Math.PI / 2);
                                        const shadowMaterial = new THREE.MeshBasicMaterial({
                                            color: colors(node.id),
                                            transparent: true,
                                            opacity: 0.5,
                                        });
                                        const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
                                        allNodesGroupDetails.add(shadowMesh);

                                        const labelCanvas = document.createElement('canvas');
                                        const labelContext = labelCanvas.getContext('2d');
                                        const text = node.name.toUpperCase();
                                        const textWidth = labelContext.measureText(text).width;
                                        const textX = labelCanvas.width / 3.5 - textWidth / 1;
                                        const textY = labelCanvas.height / 2 + 5;
                                        labelContext.save();
                                        labelContext.fillStyle = colors(node.id);
                                        labelContext.font = 'bold 20px Arial';
                                        labelContext.filter = "contrast(2)";
                                        labelContext.textBaseline = 'middle';
                                        labelContext.fillText(text, textX, textY);
                                        labelContext.rotate(Math.PI / 2);
                                        labelContext.restore();
                                        const texture = new THREE.CanvasTexture(labelCanvas);
                                        const newMaterial = new THREE.MeshBasicMaterial({ map: texture });

                                        const sphere = new THREE.Mesh(newGeometry, newMaterial);
                                        sphere.position.set(0, 0, 0);
                                        allNodesGroupDetails.add(sphere);
                                        scene.add(allNodesGroupDetails)

                                        const tableNodes = nodes.filter(node => node.type === 'table');
                                        const targetIds = new Set(links.filter(link => link.source === node.id).map(link => link.target));
                                        const tableNodesFiltered = tableNodes.filter(node => targetIds.has(node.id));
                                        const numTables = tableNodesFiltered.length;
                                        tableNodesFiltered.forEach((targetNode, index) => {
                                            const theta = (index / numTables) * Math.PI * 2;
                                            const offset = Math.PI / 2;

                                            const x = sphereRadius * Math.cos(theta + offset);
                                            const y = sphereRadius * Math.sin(theta + offset);
                                            const z = 0;

                                            const geometry = new THREE.SphereGeometry(0.3, 18, 12);
                                            const material = new THREE.MeshBasicMaterial({ color: colors(targetNode.id) });
                                            const sphere = new THREE.Mesh(geometry, material);
                                            sphere.position.set(x, y, z);
                                            allNodesGroupDetails.add(sphere);

                                            const shadowGeometry = new THREE.SphereGeometry(0.4, 18, 12);
                                            const shadowMaterial = new THREE.MeshBasicMaterial({
                                                color: colors(targetNode.id),
                                                transparent: true,
                                                opacity: 0.5,
                                            });
                                            const shadowSphere = new THREE.Mesh(shadowGeometry, shadowMaterial);
                                            shadowSphere.position.set(x, y, z);
                                            allNodesGroupDetails.add(shadowSphere);

                                            const sourceNode = nodes.find(n => n.id === node.id);
                                            const sourcePosition = new THREE.Vector3(0, 0, 0);
                                            const targetPosition = new THREE.Vector3(x, y, z);
                                            const distance = sourcePosition.distanceTo(targetPosition);
                                            const lineGeometry = new THREE.CylinderGeometry(0.05, 0.05, distance, 18);
                                            const lineMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(colors(sourceNode.id)) });
                                            const line = new THREE.Mesh(lineGeometry, lineMaterial);

                                            const direction = new THREE.Vector3().subVectors(targetPosition, sourcePosition);
                                            const midpoint = new THREE.Vector3().addVectors(sourcePosition, direction.clone().multiplyScalar(0.5));
                                            line.position.copy(midpoint);

                                            const axis = new THREE.Vector3(0, 1, 0);
                                            line.quaternion.setFromUnitVectors(axis, direction.clone().normalize());

                                            allNodesGroupDetails.add(line);
                                            scene.add(allNodesGroupDetails);
                                            loader.load(fontUrl, function (font) {
                                                const textMaterial = new THREE.MeshBasicMaterial({ color: colors(targetNode.id) });
                                                const countTextMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

                                                const countTextGeometry = new TextGeometry(targetNode.count.toString(), {
                                                    font: font,
                                                    size: 0.4,
                                                    height: 0.02,
                                                });
                                                const countText = new THREE.Mesh(countTextGeometry, countTextMaterial);
                                                countTextGeometry.computeBoundingBox();
                                                const textWidthCount = countTextGeometry.boundingBox.max.x - countTextGeometry.boundingBox.min.x;

                                                countText.position.set(x - textWidthCount / 2, y + 1.2, 0.1);
                                                allNodesGroupDetails.add(countText);

                                                const nameTextGeometry = new TextGeometry(targetNode.name.toUpperCase(), {
                                                    font: font,
                                                    size: 0.4,
                                                    height: 0.02,
                                                });
                                                const nameText = new THREE.Mesh(nameTextGeometry, textMaterial);
                                                nameTextGeometry.computeBoundingBox();
                                                const textWidth = nameTextGeometry.boundingBox.max.x - nameTextGeometry.boundingBox.min.x;
                                                nameText.position.set(x - textWidth / 2, y + 0.55, 0.1);

                                                allNodesGroupDetails.add(nameText);
                                            });
                                        });
                                        scene.add(allNodesGroupDetails)
                                    } else {
                                        allNodesGroup.rotation.y += rotationIncrement;
                                        serviceNodes.forEach((node) => {
                                            node.sphere.rotation.y -= rotationIncrement;
                                            node.cylinder.rotation.y -= rotationIncrement;
                                        });
                                        globalRotation += rotationIncrement;
                                    }
                                }, rotateDuration / framesPerRotation);
                            }
                        }
                    };
                } else {
                    const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
                    const y = sphereRadius * Math.cos(phi);
                    const z = sphereRadius * Math.sin(theta) * Math.sin(phi);

                    const geometry = new THREE.SphereGeometry(0.2, 18, 12);
                    const material = new THREE.MeshBasicMaterial({ color: colors(node.id), });

                    const sphere = new THREE.Mesh(geometry, material);

                    const countLabel = createLabel(node.count, "white", 20);
                    countLabel.position.set(x, y + 1, z);
                    allNodesGroup.add(countLabel)

                    const nameLabel = createLabel(node.name.toUpperCase(), colors(node.id), 26);
                    nameLabel.position.set(x, y + 0.3, z);
                    allNodesGroup.add(nameLabel)
                    node.countLabel = countLabel;
                    node.nameLabel = nameLabel;

                    sphere.position.set(x, y, z);
                    node.sphere = sphere;
                    allNodesGroup.add(sphere)
                    scene.add(allNodesGroup)


                }
            });

            links.forEach(link => {

                const sourceNode = nodes.find(n => n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target);

                if (sourceNode.type === 'service' && targetNode.type === 'table') {
                    const sourcePosition = new THREE.Vector3(
                        sourceNode.sphere.position.x,
                        sourceNode.sphere.position.y,
                        sourceNode.sphere.position.z
                    );
                    const targetPosition = new THREE.Vector3(
                        targetNode.sphere.position.x,
                        targetNode.sphere.position.y,
                        targetNode.sphere.position.z
                    );

                    const distance = sourcePosition.distanceTo(targetPosition);
                    const geometry = new THREE.CylinderGeometry(0.01, 0.01, distance, 18);
                    const material = new THREE.MeshBasicMaterial({
                        color: new THREE.Color(colors(sourceNode.id)),
                    });
                    const line = new THREE.Mesh(geometry, material);

                    const direction = new THREE.Vector3().subVectors(targetPosition, sourcePosition);
                    const midpoint = new THREE.Vector3().addVectors(sourcePosition, direction.multiplyScalar(0.5));
                    line.position.copy(midpoint);
                    const axis = new THREE.Vector3(0, 1, 0);
                    line.quaternion.setFromUnitVectors(axis, direction.clone().normalize());
                    line.name = 'link';
                    allNodesGroup.add(line);
                    scene.add(allNodesGroup)
                }
            });

        };

        const { nodes, links } = extractNodesAndLinks(data);
        createVisualNodesAndLinks(nodes, links);
        addEventListeners()

        function createLegend(nodes) {
            const legendContainer = document.createElement('div');

            legendContainer.style.position = "absolute"
            legendContainer.style.top = "20px"
            legendContainer.style.left = "20px"
            legendContainer.style.border = "1px solid #ffffff"
            legendContainer.style.display = "grid"
            legendContainer.style.padding = "15px"
            legendContainer.style.gridTemplateColumns = "repeat(4, 1fr)"
            legendContainer.style.gap = "8px"
            legendContainer.style.background = "rgba(184, 184, 185, .2)"
            legendContainer.style.borderRadius = "8px"
            renderer.domElement.parentElement.appendChild(legendContainer);

            const legendItems = nodes.filter(node => node.type === 'service');
            legendItems.forEach(node => {
                const legendItem = document.createElement('div');
                legendItem.classList.add('legend-item');

                const colorBox = document.createElement('div');
                colorBox.classList.add('legend-color');
                colorBox.style.backgroundColor = "black";
                colorBox.style.border = `2px solid ${colors(node.id)}`;
                colorBox.style.boxShadow = `0px 0px 15px ${colors(node.id)}`;

                const label = document.createElement('span');
                label.textContent = node.name;

                legendItem.appendChild(colorBox);
                legendItem.appendChild(label);
                legendContainer.appendChild(legendItem);
            });
        }
        createLegend(nodes);


        function createLabel(text, color, paddingT) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontSize = 15;
            const padding = paddingT || 30;
            const font = `bold ${fontSize}px Arial`;
            context.font = font;
            const textMetrics = context.measureText(text);
            const width = textMetrics.width + padding * 2;
            const height = fontSize + padding * 2;
            canvas.width = width;
            canvas.height = height;

            context.font = font;
            context.imageSmoothingEnabled = true
            context.filter = "contrast(1.4)";
            context.fillStyle = '#31304D';
            context.fillText(text, padding - 0.8, fontSize + padding - 1);
            context.fillStyle = color || "white";
            context.fillText(text, padding, fontSize + padding);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            const material = new THREE.SpriteMaterial({ map: texture });
            const label = new THREE.Sprite(material);
            label.rotation.x = Math.PI;
            label.scale.set(width / height, 0.8, 1);
            return label;
        }

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1';
        renderer.domElement.parentElement.appendChild(container);
        const button = document.createElement('button');
        button.textContent = 'Play - Rotate';
        button.style.width = '150px';
        button.style.padding = '8px';
        button.style.cursor = 'pointer';
        button.style.backgroundColor = 'white';
        container.appendChild(button);
        button.addEventListener('click', () => {
            scene.fog = new THREE.FogExp2(0xD8D9DA, 0.048);
            allNodesGroup.rotation.y = 0;
            allNodesGroup.visible = true;
            allNodesGroupDetails.visible = false;
            allNodesGroupDetails.children.length = 0;

            allNodesGroup.children.forEach((node) => {
                if (node.userData.shadowMesh) {
                    node.userData.shadowMesh.visible = false;
                }
            });
            allNodesGroup.children
                .filter((other) => other.name === "link")
                .forEach((n) => { n.material.visible = true; });
            connectingLines.forEach((line) => {
                line.visible = false;
            });
            isClicked = false;
        });


        // ================================================ 

        function addEventListeners() {
            const serviceNodes = nodes.filter(node => node.type === 'service');

            renderer.domElement.addEventListener('click', onDocumentClick);
            renderer.domElement.addEventListener('mousemove', onDocumentMouseMove);

            function onDocumentClick(event) {
                if (isClicked || isDraggingControls) return;

                const clickedObject = getObjectFromMouseEvent(event, serviceNodes);
                if (!clickedObject) return;
                clickedObject.onClick();
            }

            function onDocumentMouseMove(event) {
                if (isClicked || isDraggingControls) return;

                const hoveredObject = getObjectFromMouseEvent(event, serviceNodes);
                document.body.style.cursor = hoveredObject ? 'pointer' : 'default';
            }

            function getObjectFromMouseEvent(event, nodes) {
                const mouse = getMousePosition(event);
                const intersects = getIntersectingObjects(mouse, nodes);
                return intersects.length > 0 ? intersects[0].object : null;
            }

            function getIntersectingObjects(mouse, nodes) {

                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse, camera);
                return raycaster.intersectObjects(nodes.map(node => node.sphere));
            }

            function getMousePosition(event) {
                const mouse = new THREE.Vector2();
                mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                return mouse;
            }
        }
        // ================================================ 


        const animate = () => {
            requestAnimationFrame(animate);
            renderer.setClearAlpha(1);
            renderer.setClearColor(0x072541);

            if (mixer) {
                mixer.update(0.01);
            }

            if (!isClicked) {
                scene.rotation.y += rotationY;
                serviceNodes = nodes.filter(node => node.type === 'service');
                serviceNodes.forEach((node) => {

                    node.sphere.rotation.y -= rotationY;
                    node.cylinder.rotation.y -= rotationY;

                    if (node.sphere.userData.isSelected && node.sphere.userData.shadowMesh) {

                        const shadowMesh = node.sphere.userData.shadowMesh;
                        shadowMesh.position.copy(node.sphere.position);
                        shadowMesh.rotation.copy(node.sphere.rotation);
                    }
                });
                tableNodes = nodes.filter(node => node.type === 'table');
                tableNodes.forEach(node => {
                    if (node.countLabel && node.nameLabel) {
                        node.countLabel.rotation.y -= rotationY;
                        node.nameLabel.rotation.y -= rotationY;

                        const sphere = node.sphere;
                        const countText = node.countLabel;
                        const nameText = node.nameLabel;

                        const textDistance = 0.6;
                        const textHeight = 0.26;
                        const textX = sphere.position.x;
                        const textY = sphere.position.y + textDistance;
                        const textZ = sphere.position.z;

                        countText.position.set(textX, textY, textZ);
                        nameText.position.set(textX, textY - textHeight, textZ);
                    }
                });
                controls.update();
            } else {
                scene.rotation.y = 0;
                controls.reset();
            }
            controls.addEventListener('change', () => {
                const currentTime = Date.now();
                const timeElapsed = currentTime - lastUpdateTime;
                if (timeElapsed > 100) {
                    isControlChange = true;
                    const direction = controls.target.clone().sub(camera.position).normalize();
                    serviceNodes.forEach((node) => {
                        const angle = Math.atan2(direction.x, direction.z) + Math.PI;
                        const angleX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));

                        node.sphere.rotation.y = angle;
                        node.cylinder.rotation.y = angle;
                        node.sphere.rotation.x = angleX;
                        node.cylinder.rotation.x = angleX;
                    });
                    tableNodes.forEach((node) => {
                        const angle = Math.atan2(direction.x, direction.z) + Math.PI;
                        node.countLabel.rotation.y = angle;
                        node.nameLabel.rotation.y = angle;
                    });
                    setTimeout(() => {
                        isControlChange = false;
                    }, 1000);
                    scene.rotation.y = 0;
                    lastUpdateTime = currentTime;
                }
            });

            controls.addEventListener('start', () => {
                isDraggingControls = true;
                document.body.style.cursor = 'grab'

            });
            controls.addEventListener('end', () => {
                isDraggingControls = false;
                document.body.style.cursor = 'default'
            });

            renderer.render(scene, camera);
        };
        animate();
    }
}
export { NetWordChart, OrbitControls, TextGeometry, FontLoader, OutlinePass, EffectComposer, RenderPass, GLTFLoader }