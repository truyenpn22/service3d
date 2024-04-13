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

        let classId = this.config.Id || "network-graph";
        let data = this.config.data || [];
        let rotationY = this.config.rotationY || 0.001;
        let rotateSpeed = this.config.rotateSpeed || 800;
        let lineSize = this.config.lineSize || 0.001
        let w = this.config.width || window.innerWidth;
        let h = this.config.height || window.innerHeight;

        let customColor = this.config.colorService || ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",]

        let serviceNodes, tableNodes;
        let isClicked = false;
        let globalRotation = 0;
        let isRotating = false;
        let connectingLines = [];
        let lastUpdateTime = Date.now();
        let isControlChange = false;
        let isDraggingControls = false;
        let serviceNodeLookup = {};
        let isZoomed = false;
        let targetWidth = w;
        let targetHeight = h;
        let currentWidth = w;
        let currentHeight = h;
        let legendContainer;
        let legendMain;
        let container;
        let fontUrl = "https://unpkg.com/three@0.77.0/examples/fonts/helvetiker_bold.typeface.json";

        // ==============================================================

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        camera.position.z = 12;



        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });

        renderer.setPixelRatio(window.devicePixelRatio, 2);
        renderer.setSize(w, h, false);

        const allNodesGroupDetails = new THREE.Group();
        const allNodesGroup = new THREE.Group();

        const containerMain = document.getElementById(classId)

        container = document.createElement('div');
        container.classList.add('menuMain');
        containerMain.appendChild(container)
        containerMain.appendChild(renderer.domElement);



        let panelGroup = document.createElement('div');
        panelGroup.classList.add('panelGroup');

        containerMain.appendChild(panelGroup)
        panelGroup.appendChild(renderer.domElement);

        // ==============================================================

        const loader = new FontLoader();
        const colors = d3.scaleOrdinal(customColor);


        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.04;
        controls.enablePan = false;
        controls.minDistance = 2;
        controls.maxDistance = 2000;

        // ==============================================================

        renderer.toneMapping = THREE.LinearToneMapping
        renderer.toneMappingExposure = 1.4


        let max = data[0].relatedTables.length
        let minValue = data[0].relatedTables.length
        data.forEach((d) => {
            if (d.relatedTables.length > max) {
                max = d.relatedTables.length
            }
            if (d.relatedTables.length < minValue) {
                minValue = d.relatedTables.length
            }
        });
        const value = d3.scaleLinear();
        value.domain([minValue, max]).range([0.3, 0.6])



        // ==============================================================

        function extractNodesAndLinks(data) {
            let nodes = [];
            let links = [];

            data.forEach(service => {
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
            scene.fog = new THREE.FogExp2(0x5e5f63, 0.05);

            nodes.forEach((node, index) => {
                const phi = Math.acos(1 - (2 * index + 1) / totalNodes);
                const goldenRatio = (1 + Math.sqrt(5)) / 2;
                const theta = 2 * Math.PI * (index + 0.5) / goldenRatio;

                if (node.type === 'service') {
                    const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
                    const y = sphereRadius * Math.cos(phi);

                    const z = sphereRadius * Math.sin(theta) * Math.sin(phi);

                    let temp = data.find(d => d.name == node.name)
                    let radia = value(temp.relatedTables.length)

                    const geometry = new THREE.CylinderGeometry(radia, radia, 0.08, 50);
                    geometry.rotateX(Math.PI / 2);

                    const labelCanvas = document.createElement('canvas');
                    const labelContext = labelCanvas.getContext('2d');

                    let text = node.name.toUpperCase();
                    if (text.length > 6) {
                        text = text.slice(0, 6) + '...';
                    }

                    const textWidth = labelContext.measureText(text).width;

                    labelCanvas.width = textWidth * 2.8;
                    labelCanvas.height = textWidth * 2.8;

                    labelContext.fillStyle = "#ffffff";
                    labelContext.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

                    labelContext.fillStyle = "#000000";
                    labelContext.font = '400 28px "Noto Sans KR", sans-serif';
                    labelContext.save();
                    labelContext.translate(labelCanvas.width / 2, labelCanvas.height / 2);
                    labelContext.rotate(-Math.PI / 2);
                    labelContext.fillText(text, -textWidth * 1.2, 6);
                    labelContext.restore();

                    const texture = new THREE.CanvasTexture(labelCanvas);

                    const material = new THREE.MeshBasicMaterial({
                        map: texture, color: colors(node.id)
                    });

                    const sphere = new THREE.Mesh(geometry, material);
                    sphere.position.set(x, y, z);
                    node.sphere = sphere;
                    allNodesGroup.add(sphere);

                    scene.add(allNodesGroup);
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
                            connectingLines.push(shadowMesh)

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

                                        const direction = new THREE.Vector3().subVectors(targetPosition, this.position);
                                        const midpoint = new THREE.Vector3().addVectors(this.position, direction.multiplyScalar(0.5));
                                        line.position.copy(midpoint);

                                        const axis = new THREE.Vector3(0, 1, 0);
                                        line.quaternion.setFromUnitVectors(axis, direction.clone().normalize());
                                        allNodesGroup.add(line);
                                        scene.add(allNodesGroup)

                                        // this.userData.connectedLines.push(line);

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
                                        connectingLines.push(shadowMesh, line);

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

                                        const newGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.08, 50);
                                        newGeometry.rotateX(Math.PI / 2);

                                        const labelCanvas = document.createElement('canvas');
                                        const labelContext = labelCanvas.getContext('2d');

                                        let text = node.name.toUpperCase();
                                        if (text.length > 6) {
                                            text = text.slice(0, 6) + '...';
                                        }

                                        const textWidth = labelContext.measureText(text).width;

                                        labelCanvas.width = textWidth * 2.8;
                                        labelCanvas.height = textWidth * 2.8;

                                        labelContext.fillStyle = "#ffffff";
                                        labelContext.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

                                        labelContext.fillStyle = "#000000";
                                        labelContext.font = '400 28px "Noto Sans KR", sans-serif';
                                        labelContext.filter = "contrast(2)";
                                        labelContext.translate(labelCanvas.width / 2, labelCanvas.height / 2);
                                        labelContext.rotate(-Math.PI / 2);
                                        labelContext.fillText(text, -textWidth * 1.2, 6);
                                        labelContext.restore();


                                        const texture = new THREE.CanvasTexture(labelCanvas);
                                        const newMaterial = new THREE.MeshBasicMaterial({ map: texture, color: colors(node.id) });

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

                                            const geometry = new THREE.SphereGeometry(0.5, 64, 32);
                                            const material = new THREE.MeshStandardMaterial({ color: 0xFF6D28, emissive: 0xFF6D28, roughness: 0.5, metalness: 2 });

                                            const sphere = new THREE.Mesh(geometry, material);

                                            sphere.position.set(x, y, z);
                                            allNodesGroupDetails.add(sphere);
                                            const sourceNode = nodes.find(n => n.id === node.id);
                                            const sourcePosition = new THREE.Vector3(0, 0, -1);
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

                                            const glowMaterial = new THREE.ShaderMaterial({
                                                uniforms: {
                                                    "c": { type: "f", value: 0.4 },
                                                    "p": { type: "f", value: 0.4 },
                                                    glowColor: { type: "c", value: new THREE.Color(0xFF6D28) },
                                                    viewVector: { type: "v3", value: camera.position }
                                                },
                                                vertexShader:
                                                    `
                                                    varying vec3 vNormal;
                                                    varying vec3 vPosition;
                                                    void main() {
                                                    vNormal = normalize( normalMatrix * normal);
                                                  
                                                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                                                    vPosition = gl_Position.xyz;
                                                    }
                                                `,
                                                fragmentShader: `
                                                varying vec3 vNormal;
                                                varying vec3 vPosition;
                                                uniform vec3 glowColor; 
                                            
                                                void main() {    
                                                    float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 0.5)), 4.0);
                                                    vec3 finalColor = glowColor * intensity;  

                                                    gl_FragColor = vec4(finalColor, 1.2) * intensity;
                                                }
                                            `,
                                                blending: THREE.AdditiveBlending,
                                                side: THREE.BackSide,
                                                transparent: true,
                                                depthWrite: false,
                                            });



                                            const atmosphereGeometry = new THREE.SphereGeometry(0.7, 64, 32);

                                            const atmosphere = new THREE.Mesh(atmosphereGeometry, glowMaterial);
                                            atmosphere.position.set(x, y, z + 0.3);

                                            allNodesGroupDetails.add(atmosphere);

                                            loader.load(fontUrl, function (font) {
                                                const textMaterial = new THREE.MeshToonMaterial({ color: 0xF4F4F4, emissive: 0xF4F4F4 });
                                                const countTextMaterial = new THREE.MeshBasicMaterial({ color: 0x00BDAA });

                                                const countTextGeometry = new TextGeometry(targetNode.count.toString(), {
                                                    font: font,
                                                    size: 0.4,
                                                    height: 0.02,
                                                });
                                                const countText = new THREE.Mesh(countTextGeometry, countTextMaterial);
                                                countTextGeometry.computeBoundingBox();
                                                const textWidthCount = countTextGeometry.boundingBox.max.x - countTextGeometry.boundingBox.min.x;

                                                countText.position.set(x - textWidthCount / 2, y + 1.5, 0.1);
                                                allNodesGroupDetails.add(countText);

                                                const nameTextGeometry = new TextGeometry(targetNode.name.toUpperCase(), {
                                                    font: font,
                                                    size: 0.4,
                                                    height: 0.02,
                                                });
                                                const nameText = new THREE.Mesh(nameTextGeometry, textMaterial);
                                                nameTextGeometry.computeBoundingBox();
                                                const textWidth = nameTextGeometry.boundingBox.max.x - nameTextGeometry.boundingBox.min.x;
                                                nameText.position.set(x - textWidth / 2, y + 0.8, 0.1);
                                                allNodesGroupDetails.add(nameText);
                                            });

                                        });


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

                    const geometry = new THREE.SphereGeometry(0.15, 18, 12);
                    const material = new THREE.MeshStandardMaterial({ color: 0xFF6D28, emissive: 0xFF6D28, emissiveIntensity: 1 });

                    const sphere = new THREE.Mesh(geometry, material);

                    const countLabel = createLabel(node.count, "#00BDAA", 28);
                    countLabel.position.set(x, y + 1, z);
                    allNodesGroup.add(countLabel)



                    const nameLabel = createLabel(node.name.toUpperCase(), "#F4F4F4", 35);
                    nameLabel.position.set(x, y + 0.1, z);
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
            const fontSize = 15;
            const padding = paddingT || 30;
            const font = `bold ${fontSize}px Arial`;
            context.font = font;
            const textMetrics = context.measureText(text);
            const width = textMetrics.width + padding * 2;
            const height = fontSize + padding * 1.8;
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

            legendMain = document.createElement('div');
            legendMain.style.background = "rgba(201, 201, 201, 0.04)"


            legendContainer = document.createElement('div');
            legendContainer.style.display = "grid"
            legendContainer.style.gridTemplateColumns = "repeat(4, 1fr)"
            legendContainer.style.width = w + "px"
            legendContainer.style.height = "fit-content"
            legendContainer.style.maxHeight = h + "px"
            legendContainer.style.gap = "3px"
            legendContainer.style.whiteSpace = "nowrap"
            legendContainer.style.overflow = "hidden"

            panelGroup.appendChild(legendMain)
            legendMain.appendChild(legendContainer);


            const legendItems = nodes.filter(node => node.type === 'service');
            legendItems.forEach(node => {
                const legendItem = document.createElement('div');
                legendItem.classList.add('legend-item');
                legendItem.style.cursor = 'pointer'
                legendItem.style.margin = "8px"

                const colorBox = document.createElement('div');
                colorBox.classList.add('legend-color');
                colorBox.style.backgroundColor = colors(node.id);

                const label = document.createElement('span');
                label.textContent = node.name;
                label.style.color = '#ffffff';
                label.style.fontSize = '12px';

                legendItem.appendChild(colorBox);
                legendItem.appendChild(label);
                legendContainer.appendChild(legendItem);
                legendItem.addEventListener('click', () => {

                    const serviceNode = serviceNodeLookup[node.id];
                    serviceNode.onClick();
                    allNodesGroupDetails.visible = true;
                    allNodesGroupDetails.children.length = 0;
                });

            });
        }

        createLegend(nodes);


        // ================================================ 

        const buttonItem = document.createElement('div')
        buttonItem.classList.add('button-item')
        container.appendChild(buttonItem)

        const geomatry = document.createElement('div')
        geomatry.classList.add('geomatryItem')
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

                scene.fog = new THREE.FogExp2(0x5e5f63, 0.05);
                scene.rotation.set(0, 0, 0)
                if (node.type === 'service') {
                    node.sphere.rotation.set(0, 0, 0);
                }
            });
            allNodesGroup.children.filter((other) => other.name === "link").forEach((n) => { n.material.visible = true; });

            connectingLines.forEach((line) => { line.visible = false; });

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
                targetWidth = w * 2.8;
                targetHeight = h * 2.8;
                zoom.innerHTML = '<img src="http://demo.idrsoft.com/apm/assets/images/ic_DBservice_out.png" alt="zoom-in">';
                container.style.backgroundColor = "#4C65BF"
                legendContainer.style.width = "-webkit-fill-available";
                legendContainer.style.height = "-webkit-fill-available";
                legendContainer.style.maxHeight = "-webkit-fill-available";
                panelGroup.style.display = "flex"
                camera.aspect = currentWidth / currentHeight;
                camera.updateProjectionMatrix();
                renderer.setPixelRatio(window.devicePixelRatio, 2);
                legendMain.style.opacity = 0

                setTimeout(() => {
                    legendMain.style.opacity = 1
                }, 800)
            } else {
                targetWidth = w;
                targetHeight = h;
                zoom.innerHTML = '<img src="http://demo.idrsoft.com/apm/assets/images/ic_DBservice_zoom.png" alt="zoom-out">';
                container.style.backgroundColor = "#32427B"
                legendContainer.style.width = w + "px";
                legendContainer.style.height = h + "px";
                panelGroup.style.display = "grid";
                renderer.setPixelRatio(window.devicePixelRatio, 2);
                legendMain.style.opacity = 0

                setTimeout(() => {
                    legendMain.style.opacity = 1
                }, 800)
            }
        });


        function animateSizeChange() {
            if (currentWidth !== targetWidth || currentHeight !== targetHeight) {
                currentWidth += (targetWidth - currentWidth) / 10;
                currentHeight += (targetHeight - currentHeight) / 10;
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