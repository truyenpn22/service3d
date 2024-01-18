import * as THREE from 'three';
import { TextGeometry } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/loaders/FontLoader.js';
import { OrbitControls } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/controls/OrbitControls.js';

let rotateInterval;
class NetWordChart {
    constructor(config) {
        this.config = config;
        this.initializeChart();
    }
    initializeChart() {

        const classId = this.config.Id || "network-graph";
        const data = this.config.data || [];
        const rotationY = this.config.rotationY || 0.001;
        const rotateSpeed = this.config.rotateSpeed || 800;
        const lineSize = this.config.lineSize || 0.001
        const w = this.config.width || window.innerWidth;
        const h = this.config.height || window.innerHeight;


        let serviceNodes, tableNodes;
        let isClicked = false;
        let globalRotation = 0;
        let isRotating = false;
        let connectingLines = [];
        let lastUpdateTime = Date.now();
        let isControlChange = false;
        let fontUrl = "https://unpkg.com/three@0.77.0/examples/fonts/helvetiker_bold.typeface.json";
        let isDraggingControls = false;
        let serviceNodeLookup = {};
        let isZoomed = false;
        let targetWidth = w;
        let targetHeight = h;
        let currentWidth = w;
        let currentHeight = h;
        let legendContainer;

        // ==============================================================

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        camera.position.z = 12;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();


        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio, 2);
        renderer.setSize(w, h, false);

        const allNodesGroupDetails = new THREE.Group();
        const allNodesGroup = new THREE.Group();

        const containerMain = document.getElementById(classId)

        const container = document.createElement('div');
        container.classList.add('container');


        containerMain.appendChild(container)
        containerMain.appendChild(renderer.domElement);

        // ==============================================================

        const loader = new FontLoader();
        const colors = d3.scaleOrdinal(d3.schemeCategory10);


        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.04;
        controls.enablePan = false;
        controls.minDistance = 2;
        controls.maxDistance = 2000;


        // ==============================================================

        const ambientLight = new THREE.AmbientLight(0x000000);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xffffff, 0.2);
        pointLight1.position.set(0, 200, 0);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xffffff, 0.2);
        pointLight2.position.set(100, 200, 100);
        scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0xffffff, 0.2);
        pointLight3.position.set(-100, -200, -100);
        scene.add(pointLight3);

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
            const maxRadius = 6;
            const minRadius = 6.2;
            const sphereRadius = Math.max(minRadius, Math.min(maxRadius, totalNodes / 10));
            scene.fog = new THREE.FogExp2(0xD8D9DA, sphereRadius === 6 ? 0.05 : 0.03);

            nodes.forEach((node, index) => {
                const phi = Math.acos(1 - (2 * index + 1) / totalNodes);
                const goldenRatio = (1 + Math.sqrt(5)) / 2;
                const theta = 2 * Math.PI * (index + 0.5) / goldenRatio;

                if (node.type === 'service') {
                    const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
                    const y = sphereRadius * Math.cos(phi);
                    const z = sphereRadius * Math.sin(theta) * Math.sin(phi);
                    const geometry = new THREE.SphereGeometry(sphereRadius === 61 ? 0.5 : 0.6, 18, 20);
                    const labelCanvas = document.createElement('canvas');
                    const labelContext = labelCanvas.getContext('2d');

                    let text = node.name.toUpperCase();
                    if (text.length > 6) {
                        text = text.slice(0, 6) + '...';
                    }
                    const textWidth = labelContext.measureText(text).width;
                    const textX = labelCanvas.width / 3.5 - textWidth;
                    const textY = labelCanvas.height / 2 + 5;
                    labelContext.save();
                    labelContext.fillStyle = colors(node.id);
                    labelContext.font = 'bold 21px Arial';
                    labelContext.filter = "contrast(2)";
                    labelContext.filter = "contrast(2)";
                    labelContext.textBaseline = 'middle';

                    labelContext.fillText(text, textX - 5, textY);
                    labelContext.restore();

                    labelContext.save();
                    labelContext.translate(labelCanvas.width / 2, labelCanvas.height / 2);
                    labelContext.rotate(Math.PI * 2)
                    labelContext.font = 'bold 21px Arial';
                    labelContext.filter = "contrast(2)";
                    labelContext.filter = "contrast(2)";
                    labelContext.fillStyle = colors(node.id);
                    labelContext.textBaseline = 'middle';
                    labelContext.fillText(text, textX - 10, 0);
                    labelContext.restore();


                    const texture = new THREE.CanvasTexture(labelCanvas);
                    const material = new THREE.MeshBasicMaterial({ map: texture });
                    const sphere = new THREE.Mesh(geometry, material);
                    sphere.position.set(x, y, z);
                    node.sphere = sphere;
                    allNodesGroup.add(sphere);


                    scene.add(allNodesGroup)
                    serviceNodeLookup[node.id] = sphere;

                    sphere.onClick = function () {
                        this.userData.isSelected = !this.userData.isSelected;
                        if (isRotating || isControlChange) {
                            return;
                        }
                        if (this.userData.isSelected) {

                            const shadowGeometry = new THREE.SphereGeometry(sphereRadius === 6 ? 0.65 : 0.75, 18, 20);
                            shadowGeometry.rotateX(Math.PI / 2);
                            const shadowMaterial = new THREE.MeshToonMaterial({
                                color: colors(node.id),
                                emissive: colors(node.id),
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
                                        const material = new THREE.MeshToonMaterial({
                                            color: colors(node.id),
                                            emissive: colors(node.id),

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
                                        const shadowMaterial = new THREE.MeshToonMaterial({
                                            color: colors(targetNode.id),
                                            emissive: colors(targetNode.id),
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
                                const rotateDuration = rotateSpeed;
                                const rotateAngle = (Math.PI * 2) - 0.4;
                                const framesPerRotation = rotateSpeed;
                                const rotationIncrement = rotateAngle / framesPerRotation;
                                controls.enabled = false;
                                next.style.pointerEvents = 'none'
                                camera.position.set(0, 0, 12)
                                rotateInterval = setInterval(() => {
                                    if (globalRotation >= rotateAngle) {
                                        clearInterval(rotateInterval);
                                        isRotating = false;
                                        globalRotation = 0;
                                        document.body.style.cursor = 'default'
                                        this.userData.isSelected = !this.userData.isSelected;
                                        isClicked = true;
                                        scene.fog = new THREE.FogExp2(0x000000, 0);
                                        next.style.pointerEvents = null

                                        allNodesGroup.children.filter((other) => other.name === "link").forEach((n) => { n.material.visible = false; });
                                        allNodesGroup.visible = false
                                        allNodesGroupDetails.visible = true


                                        const newGeometry = new THREE.SphereGeometry(1.5, 18, 20);
                                        const CylinderGeometry = new THREE.CylinderGeometry(1.6, 0.5, 0.12, 50);
                                        CylinderGeometry.rotateX(Math.PI / 2);
                                        const CylinderGeometryMaterial = new THREE.MeshToonMaterial({ color: colors(node.id), emissive: colors(node.id) });
                                        const CylinderGeometryMesh = new THREE.Mesh(CylinderGeometry, CylinderGeometryMaterial);
                                        allNodesGroupDetails.add(CylinderGeometryMesh);

                                        const shadowGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.12, 50);
                                        shadowGeometry.rotateX(Math.PI / 2);
                                        const shadowMaterial = new THREE.MeshToonMaterial({
                                            color: colors(node.id),
                                            emissive: colors(node.id),
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

                                            const geometry = new THREE.SphereGeometry(0.5, 18, 12);
                                            const material = new THREE.MeshStandardMaterial({ color: colors(targetNode.id), emissive: colors(targetNode.id), roughness: 0.5, metalness: 2 });
                                            const sphere = new THREE.Mesh(geometry, material);
                                            sphere.position.set(x, y, z);
                                            allNodesGroupDetails.add(sphere);

                                            const shadowGeometry = new THREE.SphereGeometry(0.7, 18, 12);
                                            const shadowMaterial = new THREE.MeshToonMaterial({
                                                color: colors(targetNode.id),
                                                emissive: colors(targetNode.id),
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
                                            const lineGeometry = new THREE.CylinderGeometry(0.08, 0.08, distance, 18);
                                            const lineMaterial = new THREE.MeshToonMaterial({ color: new THREE.Color(colors(sourceNode.id)), emissive: new THREE.Color(colors(sourceNode.id)) });
                                            const line = new THREE.Mesh(lineGeometry, lineMaterial);

                                            const direction = new THREE.Vector3().subVectors(targetPosition, sourcePosition);
                                            const midpoint = new THREE.Vector3().addVectors(sourcePosition, direction.clone().multiplyScalar(0.5));
                                            line.position.copy(midpoint);

                                            const axis = new THREE.Vector3(0, 1, 0);
                                            line.quaternion.setFromUnitVectors(axis, direction.clone().normalize());

                                            allNodesGroupDetails.add(line);
                                            scene.add(allNodesGroupDetails);
                                            loader.load(fontUrl, function (font) {
                                                const textMaterial = new THREE.MeshToonMaterial({ color: colors(targetNode.id), emissive: colors(targetNode.id) });
                                                const countTextMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

                                                const countTextGeometry = new TextGeometry(targetNode.count.toString(), {
                                                    font: font,
                                                    size: 0.8,
                                                    height: 0.02,
                                                });
                                                const countText = new THREE.Mesh(countTextGeometry, countTextMaterial);
                                                countTextGeometry.computeBoundingBox();
                                                const textWidthCount = countTextGeometry.boundingBox.max.x - countTextGeometry.boundingBox.min.x;

                                                countText.position.set(x - textWidthCount / 2, y + 2, 0.1);
                                                allNodesGroupDetails.add(countText);

                                                const nameTextGeometry = new TextGeometry(targetNode.name.toUpperCase(), {
                                                    font: font,
                                                    size: 0.8,
                                                    height: 0.02,
                                                });
                                                const nameText = new THREE.Mesh(nameTextGeometry, textMaterial);
                                                nameTextGeometry.computeBoundingBox();
                                                const textWidth = nameTextGeometry.boundingBox.max.x - nameTextGeometry.boundingBox.min.x;
                                                nameText.position.set(x - textWidth / 2, y + 0.8, 0.1);

                                                allNodesGroupDetails.add(nameText);
                                            });
                                        });
                                        scene.add(allNodesGroupDetails)
                                    } else {
                                        allNodesGroup.rotation.y += rotationIncrement;
                                        serviceNodes.forEach((node) => {
                                            node.sphere.rotation.y -= rotationIncrement;
                                        });
                                        globalRotation += rotationIncrement;
                                    }
                                }, rotateDuration / framesPerRotation);
                            }
                            renderer.render(scene, camera);

                        }
                    }
                } else {
                    const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
                    const y = sphereRadius * Math.cos(phi);
                    const z = sphereRadius * Math.sin(theta) * Math.sin(phi);

                    const geometry = new THREE.SphereGeometry(0.2, 18, 12);
                    const material = new THREE.MeshStandardMaterial({ color: colors(node.id), emissive: colors(node.id), roughness: 0.5, metalness: 2 });

                    const sphere = new THREE.Mesh(geometry, material);

                    const countLabel = createLabel(node.count, "#ffffff", 18);
                    countLabel.position.set(x, y + 1, z);
                    allNodesGroup.add(countLabel)

                    const nameLabel = createLabel(node.name.toUpperCase(), colors(node.id), 20);
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
                    const geometry = new THREE.CylinderGeometry(lineSize, lineSize, distance, 18);
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

        // ================================================ 

        function createLabel(text, color, paddingT) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontSize = 30;
            const padding = paddingT || 30;
            const font = `bold ${fontSize}px Arial`;
            context.font = font;
            const textMetrics = context.measureText(text);
            const width = textMetrics.width + padding * 2;
            const height = fontSize + padding * 3;
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
            label.scale.set(width / height, 0.9, 1);
            return label;
        }


        // ================================================ 

        function createLegend(nodes) {
            legendContainer = document.createElement('div');
            legendContainer.style.display = "grid"
            legendContainer.style.padding = "8px"
            legendContainer.style.gridTemplateColumns = "repeat(4, 1fr)"
            legendContainer.style.width = w + "px"
            legendContainer.style.gap = "3px"
            legendContainer.style.whiteSpace = "nowrap"
            legendContainer.style.overflow = "hidden"
            legendContainer.style.background = "rgba(201, 201, 201, 0.04)"
            legendContainer.style.transition = 'opacity 0.5s'

            renderer.domElement.parentElement.appendChild(legendContainer);

            const legendItems = nodes.filter(node => node.type === 'service');
            legendItems.forEach(node => {
                const legendItem = document.createElement('div');
                legendItem.style.cursor = 'pointer';
                legendItem.classList.add('legend-item');

                const colorBox = document.createElement('div');
                colorBox.classList.add('legend-color');
                colorBox.style.backgroundColor = colors(node.id);
                colorBox.style.boxShadow = `0px 0px 15px ${colors(node.id)}`;

                const label = document.createElement('span');
                label.textContent = node.name;
                label.style.color = '#ffffff';

                legendItem.appendChild(colorBox);
                legendItem.appendChild(label);
                legendContainer.appendChild(legendItem);
                legendItem.addEventListener('click', () => {
                    const serviceNode = serviceNodeLookup[node.id];
                    if (serviceNode && serviceNode.onClick) {
                        serviceNode.onClick();
                    }
                });

            });
        }
        createLegend(nodes);

        // ================================================ 

        const buttonItem = document.createElement('div')
        buttonItem.classList.add('button-item')
        container.appendChild(buttonItem)

        const geomatry = document.createElement('div')
        geomatry.innerHTML = '<img  src="http://demo.idrsoft.com/apm/assets/images/ic_DBservicer.png" alt="geomatry">'
        geomatry.style.paddingLeft = '10px'
        container.appendChild(geomatry)

        // ================================================ 

        const next = document.createElement('div')
        next.classList.add('button-next');
        next.innerHTML = '<img  src="http://demo.idrsoft.com/apm/assets/images/next.svg" alt="next">'
        next.style.width = '20px'
        next.style.height = '20px'
        next.style.padding = '8px'
        next.style.cursor = 'pointer'
        buttonItem.appendChild(next)
        next.addEventListener('click', () => {
            allNodesGroup.rotation.y = 0;
            allNodesGroup.visible = true;
            allNodesGroupDetails.visible = false;
            allNodesGroupDetails.children.length = 0;

            allNodesGroup.children.forEach((node) => {
                if (node.userData.shadowMesh) {
                    node.userData.shadowMesh.visible = false;
                }
            });
            nodes.forEach(node => {
                const totalNodes = nodes.length;
                const maxRadius = 5;
                const minRadius = 4;
                const sphereRadius = Math.max(minRadius, Math.min(maxRadius, totalNodes / 10));

                scene.fog = new THREE.FogExp2(0xD8D9DA, sphereRadius === 6 ? 0.05 : 0.03);
                scene.rotation.set(0, 0, 0)
                if (node.type === 'service') {
                    node.sphere.rotation.set(0, 0, 0);
                }
            });
            allNodesGroup.children
                .filter((other) => other.name === "link")
                .forEach((n) => { n.material.visible = true; });
            connectingLines.forEach((line) => {
                line.visible = false;
            });

            isClicked = false;
            controls.enabled = true;
            controls.reset();
            clearInterval(rotateInterval);
            camera.position.set(0, 0, 12)
        });


        // ================================================ 


        const zoom = document.createElement('div')
        zoom.classList.add('button-zoom')
        zoom.innerHTML = '<img  src="http://demo.idrsoft.com/apm/assets/images/ic_DBservice_zoom.png" alt="zoom-in">';
        zoom.style.padding = '6px'
        zoom.style.cursor = 'pointer'
        buttonItem.appendChild(zoom)

        zoom.addEventListener('click', () => {
            isZoomed = !isZoomed;
            if (isZoomed) {
                targetWidth = w * 1.5;
                targetHeight = h * 1.5;
                zoom.innerHTML = '<img src="http://demo.idrsoft.com/apm/assets/images/ic_DBservice_out.png" alt="zoom-in">';
                camera.aspect = currentWidth / currentHeight;
                camera.updateProjectionMatrix();
                legendContainer.style.width = "-webkit-fill-available";

            } else {
                targetWidth = w;
                targetHeight = h;
                zoom.innerHTML = '<img src="http://demo.idrsoft.com/apm/assets/images/ic_DBservice_zoom.png" alt="zoom-out">';
                renderer.setPixelRatio(window.devicePixelRatio, 2);
                legendContainer.style.width = w + "px";
            }
            legendContainer.style.opacity = '0';
            setTimeout(() => {
                legendContainer.style.opacity = '1';
            }, 600);
        });


        function animateSizeChange() {
            if (currentWidth !== targetWidth || currentHeight !== targetHeight) {
                currentWidth += (targetWidth - currentWidth) / 10;
                currentHeight += (targetHeight - currentHeight) / 10;
                renderer.setPixelRatio(window.devicePixelRatio);
                renderer.setSize(currentWidth, currentHeight, false);
            }
        }


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
                mouse.x = (event.offsetX / currentWidth) * 2 - 1;
                mouse.y = -(event.offsetY / currentHeight) * 2 + 1;

                return mouse;
            }
        }


        // ================================================ 


        function controlChange() {

            controls.addEventListener('change', () => {
                const currentTime = Date.now();
                const timeElapsed = currentTime - lastUpdateTime;
                const cameraPosition = camera.position.clone();

                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.lookAt(cameraPosition, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
                if (timeElapsed > 100) {
                    for (let i = 0; i < serviceNodes.length; i++) {
                        const node = serviceNodes[i];
                        node.sphere.quaternion.setFromRotationMatrix(rotationMatrix);
                    }
                    setTimeout(() => {
                        isControlChange = false;
                    }, 1000);

                    scene.rotation.y += 0;
                    lastUpdateTime = currentTime;
                }
            });

            controls.addEventListener('start', () => {
                isDraggingControls = true;
                document.body.style.cursor = 'grab'
                scene.rotation.y = 0;
            });
            controls.addEventListener('end', () => {
                isDraggingControls = false;
                document.body.style.cursor = 'default'
            });

            controls.update();

        }

        // ================================================ 

        const animate = () => {
            requestAnimationFrame(animate);
            renderer.setClearAlpha(0);
            animateSizeChange();
            controlChange();
            if (!isClicked) {
                scene.rotation.y += rotationY;
                serviceNodes = nodes.filter(node => node.type === 'service');
                serviceNodes.forEach((node) => {

                    node.sphere.rotation.y -= rotationY;



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
            renderer.render(scene, camera);
        };
        animate();
    }
}
export { NetWordChart }