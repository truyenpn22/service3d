import * as THREE from 'three';
import { TextGeometry } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/loaders/FontLoader.js';
import { OrbitControls } from 'https://www.unpkg.com/three@0.140.0/examples/jsm/controls/OrbitControls.js';


class NetWordChart {
    constructor(config) {
        this.config = config;
        this.initializeChart();
    }
    initializeChart() {

        let classId = this.config.Id || "network-graph";
        let data = this.config.data || [];
        let rotationY = this.config.rotationY || 2;
        let moveToNode = this.config.moveToNode || 3000
        let durationDetail = this.config.durationDetail || moveToNode / 2
        let lineSize = this.config.lineSize || 0.001;
        let w = this.config.width || 250;
        let h = this.config.height || 250;
        let customizeZoom = this.config.customizeZoom || 2.2
        let isClicked = false;
        let isRotating = false;
        let controlsInitialized = false;
        let isRestarted = false;
        let isZoomed = false;
        let serviceNodeLookup = {};
        let connectingLines = [];
        let raycasterEnabled = true;
        let _wzm;
        let _hzm;
        let sphereRadius;
        let resetChart;
        let serviceNodes;
        let containerMain;
        let legendContainer;
        let legendMain;
        let container;
        let fontUrl = "https://unpkg.com/three@0.77.0/examples/fonts/helvetiker_bold.typeface.json";

        // ==============================================================


        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(72, w / h, 0.1, 1000);
        camera.position.z = 12;

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(window.devicePixelRatio, 2);
        renderer.setSize(w, h, false);
        renderer.toneMapping = THREE.LinearToneMapping;
        renderer.toneMappingExposure = 1.5;

        const allNodesGroupDetails = new THREE.Group();
        const allNodesGroup = new THREE.Group();

        containerMain = document.getElementById(classId)
        container = document.createElement('div');
        container.classList.add('menuMain');
        containerMain.appendChild(container)
        containerMain.appendChild(renderer.domElement);




        let panelGroup = document.createElement('div');
        panelGroup.classList.add('panelGroup');
        panelGroup.style.display = "grid"
        panelGroup.appendChild(renderer.domElement).style.borderBottomLeftRadius = '10px';

        containerMain.appendChild(panelGroup)


        // ==============================================================

        const loader = new FontLoader();


        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.04;
        controls.enablePan = false;
        controls.minDistance = 10;
        controls.maxDistance = 500;


        // ==============================================================

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
                        color: service.color,
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
            sphereRadius = Math.max(minRadius, Math.min(maxRadius, totalNodes / 10));
            scene.fog = new THREE.FogExp2(0x5e5f63, 0.05);

            nodes.forEach((node, index) => {
                const phi = Math.acos(1 - (2 * index + 1) / totalNodes);
                const goldenRatio = (1 + Math.sqrt(5)) / 2;
                const theta = 2 * Math.PI * (index + 0.5) / goldenRatio;

                const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
                const y = sphereRadius * Math.cos(phi);
                const z = sphereRadius * Math.sin(theta) * Math.sin(phi);

                if (node.type === 'service') {
                    createServiceNode(node, x, y, z);
                } else {
                    createTableNode(node, x, y, z);
                }
            });

            createLinks(nodes, links);
        }

        function createServiceNode(node, x, y, z) {
            let temp = data.find(d => d.name === node.name);
            let radius = value(temp.relatedTables.length);
            const geometry = new THREE.CylinderGeometry(radius, radius, 0.08, 50);
            geometry.rotateX(Math.PI / 2);

            const labelCanvas = createLabelCanvas(node.name);
            const texture = new THREE.CanvasTexture(labelCanvas);

            const material = new THREE.MeshBasicMaterial({ map: texture, color: node.color });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(x, y, z);

            node.sphere = sphere;
            allNodesGroup.add(sphere);
            scene.add(allNodesGroup);
            serviceNodeLookup[node.id] = sphere;

            sphere.onClick = () => handleNodeClick(sphere, node);
        }

        function createTableNode(node, x, y, z) {
            const geometry = new THREE.SphereGeometry(0.1, 18, 12);
            const material = new THREE.MeshBasicMaterial({ color: 0x448388 });
            const sphere = new THREE.Mesh(geometry, material);

            const countLabel = createTableLabel(node.count, "#a0cccf", 15);
            allNodesGroup.add(countLabel);
            countLabel.position.set(x, y + 0.55, z);

            const nameLabel = createTableLabel(node.name.toUpperCase(), "#ffffff");
            allNodesGroup.add(nameLabel);
            nameLabel.position.set(x, y + 0.35, z);

            node.countLabel = countLabel;
            node.nameLabel = nameLabel;

            sphere.position.set(x, y, z);
            node.sphere = sphere;
            allNodesGroup.add(sphere);
            scene.add(allNodesGroup);
        }


        function createTableLabel(text, color, FontSize) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontSize = FontSize || 12;
            const padding = 35;
            const font = `500 ${fontSize}px Arial`;
            context.font = font;
            const textMetrics = context.measureText(text);
            const width = textMetrics.width + padding * 2;
            const height = fontSize + padding * 1.8;
            canvas.width = width;
            canvas.height = height;

            context.font = `Bold ${fontSize}px Arial`;
            context.fillStyle = color || "white";

            context.fillText(text, padding, fontSize + padding);

            const texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;

            const material = new THREE.SpriteMaterial({ map: texture, depthTest: true, depthWrite: false, transparent: true });

            const label = new THREE.Sprite(material);
            label.scale.set(width / height, 0.9, 1);
            return label;
        }

        function createLinks(nodes, links) {
            links.forEach(link => {
                const sourceNode = nodes.find(n => n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target);

                if (sourceNode.type === 'service' && targetNode.type === 'table') {
                    const sourcePosition = sourceNode.sphere.position;
                    const targetPosition = targetNode.sphere.position;

                    const distance = sourcePosition.distanceTo(targetPosition);
                    const geometry = new THREE.CylinderGeometry(lineSize, lineSize, distance, 18);
                    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(sourceNode.color) });
                    const line = new THREE.Mesh(geometry, material);

                    const direction = new THREE.Vector3().subVectors(targetPosition, sourcePosition);
                    const midpoint = new THREE.Vector3().addVectors(sourcePosition, direction.multiplyScalar(0.5));
                    line.position.copy(midpoint);
                    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

                    line.name = 'link';
                    allNodesGroup.add(line);
                    scene.add(allNodesGroup);
                }
            });
        }


        function createLabelCanvas(text, radius) {
            const labelCanvas = document.createElement('canvas');
            const labelContext = labelCanvas.getContext('2d');

            const maxCharactersPerLine = text.length >= 8 ? 5 : 4;
            const lines = [];
            for (let i = 0; i < text.length; i += maxCharactersPerLine) {
                lines.push(text.slice(i, i + maxCharactersPerLine));
            }

            labelContext.font = `400 18px "Noto Sans KR", sans-serif`;
            const textWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, labelContext.measureText(line).width), 0);

            const lineHeight = text.length <= 4 ? 50 : 30;
            const fontSize = 28;

            labelContext.font = `400 ${fontSize}px "Noto Sans KR", sans-serif`;

            labelCanvas.width = textWidth * 2.8;
            labelCanvas.height = lineHeight * lines.length * 2.8;

            labelContext.fillStyle = "#ffffff";
            labelContext.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

            labelContext.fillStyle = "#000000";
            labelContext.font = `400 ${fontSize}px "Noto Sans KR", sans-serif`;
            labelContext.save();
            labelContext.translate(labelCanvas.width / 2, labelCanvas.height / 2);
            labelContext.rotate(-Math.PI / 2);

            const safeDistance = radius ? (radius * 2) * 6 : 0;
            lines.forEach((line, index) => {
                const textWidth = labelContext.measureText(line).width;
                const xPosition = -textWidth / 2;
                const yPosition = ((index - lines.length / 8) * lineHeight) + safeDistance;
                labelContext.fillText(line, xPosition, yPosition);
            });

            labelContext.restore();
            return labelCanvas;
        }


        function handleNodeClick(sphere, node) {
            addNodeHighlight(sphere, node);
            moveCameraToNode(sphere.position, node);
        }



        function addNodeHighlight(sphere, node) {
            let temp = data.find(d => d.name === node.name);
            let radius = value(temp.relatedTables.length);

            const shadowGeometry = new THREE.SphereGeometry(radius + 0.1, 18, 20);
            shadowGeometry.rotateX(Math.PI / 2);
            const shadowMaterial = new THREE.MeshToonMaterial({
                color: node.color,
                emissive: node.color,
                transparent: true,
                opacity: 0.5,
            });
            const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
            allNodesGroup.add(shadowMesh);
            sphere.userData.shadowMesh = shadowMesh;
            shadowMesh.position.copy(sphere.position);
            scene.add(allNodesGroup);
            connectingLines.push(shadowMesh);

            sphere.userData.connectedLines = [];

            links.forEach(link => {
                if (link.source === node.id) {
                    const targetNode = nodes.find(n => n.id === link.target);
                    if (targetNode && targetNode.type === 'table') {
                        const targetPosition = targetNode.sphere.position;
                        const distance = sphere.position.distanceTo(targetPosition);
                        const geometry = new THREE.CylinderGeometry(0.04, 0.04, distance, 18);
                        const material = new THREE.MeshToonMaterial({
                            color: node.color,
                            emissive: node.color,
                        });
                        const line = new THREE.Mesh(geometry, material);

                        const direction = new THREE.Vector3().subVectors(targetPosition, sphere.position);
                        const midpoint = new THREE.Vector3().addVectors(sphere.position, direction.multiplyScalar(0.5));
                        line.position.copy(midpoint);

                        line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
                        allNodesGroup.add(line);

                        const shadowGeometry = new THREE.SphereGeometry(0.2, 18, 12);
                        shadowGeometry.rotateX(Math.PI / 2);
                        const shadowMaterial = new THREE.MeshToonMaterial({
                            color: 0x529EA4,
                            emissive: 0x529EA4,
                            transparent: true,
                            opacity: 0.5,
                        });
                        const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
                        shadowMesh.position.copy(targetPosition);
                        allNodesGroup.add(shadowMesh);
                        connectingLines.push(shadowMesh, line);
                    }
                }
            });
            scene.add(allNodesGroup);
        }

        function animateProperty(object, property, startValue, endValue, duration, onComplete) {
            const startTime = performance.now();

            function animate() {
                const currentTime = performance.now();
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);

                object[property] = startValue + (endValue - startValue) * progress;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else if (onComplete) {
                    onComplete();
                }
            }

            animate();
        }

        function animateProperty(object, property, startValue, endValue, duration, onComplete) {
            const startTime = performance.now();

            function animate() {
                const currentTime = performance.now();
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);

                object[property] = startValue + (endValue - startValue) * progress;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else if (onComplete) {
                    onComplete();
                }
            }

            animate();
        }



        function reStart() {
            const legendItems = document.querySelectorAll('.legend-item')
            legendItems.forEach(item => {
                item.style.pointerEvents = 'auto'
            });

            allNodesGroup.rotation.y = 0
            allNodesGroup.visible = true
            allNodesGroupDetails.visible = false
            allNodesGroupDetails.children.length = 0

            scene.fog = new THREE.FogExp2(0x5e5f63, 0.05)

            allNodesGroup.children.filter((other) => other.name === "link").forEach((n) => { n.material.visible = true; })
            connectingLines.forEach((line) => { line.visible = false; })
            isRestarted = true;

            isClicked = false
            isRotating = false
            raycasterEnabled = true;
            legendMain.style.display = "block"
            camera.position.set(0, 0, 12)
            controlChange()
        }


        function animateCamera(startPosition, endPosition, duration, initialDistance, callback) {
            const startTime = performance.now();

            function animate() {
                if (isRestarted) return;

                const currentTime = performance.now();
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1);

                camera.position.lerpVectors(startPosition, endPosition, progress);
                const initialFOV = camera.fov;

                const currentDistance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
                const distanceRatio = initialDistance / currentDistance;
                camera.position.multiplyScalar(distanceRatio);


                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    camera.position.copy(endPosition);
                    camera.fov = initialFOV;
                    camera.updateProjectionMatrix();
                    if (callback) {
                        callback();
                    }
                }
            }

            animate();
        }

        function moveCameraToNode(position, node) {
            isRestarted = false;

            const cameraPosition = new THREE.Vector3(position.x, position.y, position.z);
            const duration = moveToNode;

            const initialDistance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));

            animateCamera(camera.position, cameraPosition, duration, initialDistance);
            setTimeout(() => {
                if (isRestarted) return;
                showNodeDetails(node);
            }, durationDetail);
        }




        function showNodeDetails(node) {
            isRotating = true;
            isClicked = true;
            scene.fog = new THREE.FogExp2(0x000000, 0);

            resetChart.style.pointerEvents = null;
            const legendItems = document.querySelectorAll('.legend-item');
            legendItems.forEach(item => {
                item.style.pointerEvents = 'none';
            });
            raycasterEnabled = false;

            document.body.style.cursor = 'default'
            legendMain.style.display = "none";


            resetChart.style.pointerEvents = null;
            connectingLines.forEach((line) => { line.visible = false; });

            allNodesGroup.children.filter((other) => other.name === "link").forEach((n) => { n.material.visible = false; });
            allNodesGroup.visible = false;
            allNodesGroupDetails.visible = true;


            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            const image = new Image();
            image.src = './img/circle.png';
            image.onload = function () {
                canvas.width = image.width;
                canvas.height = image.height;


                const maxCharactersPerLine = node.name.length >= 8 ? 5 : 4;
                const lines = [];
                for (let i = 0; i < node.name.length; i += maxCharactersPerLine) {
                    lines.push(node.name.slice(i, i + maxCharactersPerLine));
                }

                const lineHeight = node.name.length <= 4 ? 50 : 40;


                if (node.color === "#008DDA") {
                    context.filter = "hue-rotate(0deg)"
                } else if (node.color === "#ff8b24") {
                    context.filter = "hue-rotate(180deg)"

                } else if (node.color === "#D85741") {
                    context.filter = "hue-rotate(120deg)"

                }

                context.font = '700 40px "Noto Sans KR", sans-serif';
                context.fillStyle = 'red';
                context.drawImage(image, 0, 0);
                context.translate(canvas.width / 2, canvas.height / 1.8);

                lines.forEach((line, index) => {
                    const textWidth = context.measureText(line).width;
                    const xPosition = -textWidth / 2;
                    const yPosition = ((index - lines.length / 8) * lineHeight);
                    context.fillText(line, xPosition, yPosition);
                });


                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
                const geometry = new THREE.PlaneGeometry(canvas.width / 80, canvas.height / 80);
                const mesh = new THREE.Mesh(geometry, material);

                mesh.position.set(0, 0, 1);

                allNodesGroupDetails.add(mesh);
                scene.add(allNodesGroupDetails);
            };


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

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                const image = new Image();
                image.src = './img/table.png';
                image.onload = () => {
                    canvas.width = image.width;
                    canvas.height = image.height;

                    context.drawImage(image, 0, 0);


                    const texture = new THREE.CanvasTexture(canvas);

                    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
                    const geometry = new THREE.PlaneGeometry(canvas.width / 1500, canvas.height / 1500);

                    const sphere = new THREE.Mesh(geometry, material);

                    sphere.position.set(x, y, z + 0.1);
                    animateProperty(sphere.position, 'x', 0, x, 800);
                    animateProperty(sphere.position, 'y', 0, y, 800);
                    animateProperty(sphere.position, 'z', 0, z + 0.1, 800);
                    allNodesGroupDetails.add(sphere);
                    scene.add(allNodesGroupDetails);
                    allNodesGroupDetails.add(sphere);
                };

                const sourceNode = nodes.find(n => n.id === node.id);
                const sourcePosition = new THREE.Vector3(0, 0, 0);
                const targetPosition = new THREE.Vector3(x, y, z);
                const distance = sourcePosition.distanceTo(targetPosition);
                const lineGeometry = new THREE.CylinderGeometry(0.02, 0.02, distance, 18);
                const lineMaterial = new THREE.MeshToonMaterial({ color: sourceNode.color, emissive: sourceNode.color });
                const line = new THREE.Mesh(lineGeometry, lineMaterial);

                const direction = new THREE.Vector3().subVectors(targetPosition, sourcePosition);
                const midpoint = new THREE.Vector3().addVectors(sourcePosition, direction.clone().multiplyScalar(0.5));
                line.position.copy(midpoint);

                const axis = new THREE.Vector3(0, 1, 0);
                line.quaternion.setFromUnitVectors(axis, direction.clone().normalize());

                const initialScale = { y: -0.01 };
                line.scale.set(1, initialScale.y, 1);
                allNodesGroupDetails.add(line);
                scene.add(allNodesGroupDetails);

                animateProperty(line.scale, 'y', initialScale.y, 1, 800);


                loader.load(fontUrl, function (font) {
                    const textMaterial = new THREE.MeshToonMaterial({ color: 0xF4F4F4, emissive: 0xF4F4F4 });
                    const countTextMaterial = new THREE.MeshBasicMaterial({ color: 0xa0cccf });

                    const countTextGeometry = new TextGeometry(targetNode.count.toString(), {
                        font: font,
                        size: 0.35,
                        height: 0.02,
                    });
                    const countText = new THREE.Mesh(countTextGeometry, countTextMaterial);
                    countTextGeometry.computeBoundingBox();
                    const textWidthCount = countTextGeometry.boundingBox.max.x - countTextGeometry.boundingBox.min.x;

                    allNodesGroupDetails.add(countText);

                    const nameTextGeometry = new TextGeometry(targetNode.name.toUpperCase(), {
                        font: font,
                        size: 0.35,
                        height: 0.02,
                    });
                    const nameText = new THREE.Mesh(nameTextGeometry, textMaterial);
                    nameTextGeometry.computeBoundingBox();
                    const textWidth = nameTextGeometry.boundingBox.max.x - nameTextGeometry.boundingBox.min.x;

                    const isTableFacingUpOrDown = Math.abs(direction.y) > 0.5;

                    const yOffsetCount = isTableFacingUpOrDown ? (direction.y > 0 ? 1.5 : -1.2) : 1.5;
                    const yOffsetName = isTableFacingUpOrDown ? (direction.y > 0 ? 0.8 : -1.8) : 0.8;

                    countText.position.set(x - textWidthCount / 2, y + yOffsetCount, z);
                    nameText.position.set(x - textWidth / 2, y + yOffsetName, z);


                    allNodesGroupDetails.add(nameText);
                });
            });
        }



        const { nodes, links } = extractNodesAndLinks(data);
        createVisualNodesAndLinks(nodes, links);


        // ================================================ 

        function createLegend(nodes) {
            legendMain = document.createElement('div');
            legendMain.style.borderBottomLeftRadius = "10px"
            legendMain.style.borderBottomRightRadius = "10px"

            legendContainer = document.createElement('div');
            legendContainer.style.display = "grid"
            legendContainer.style.gridTemplateColumns = w <= 300 ? "repeat(3, 1fr)" : "repeat(4, 1fr)"
            legendContainer.style.margin = "4px"

            panelGroup.appendChild(legendMain)
            legendMain.appendChild(legendContainer);

            const legendItems = nodes.filter(node => node.type === 'service');
            legendItems.forEach(node => {
                const legendItem = document.createElement('div');
                legendItem.classList.add('legend-item');
                legendItem.style.cursor = 'pointer';
                legendItem.style.margin = "5px 8px";

                const colorBox = document.createElement('div');
                colorBox.classList.add('legend-color');
                colorBox.style.backgroundColor = node.color;

                const label = document.createElement('span');
                label.textContent = node.name;
                label.style.color = '#ffffff';
                label.style.fontSize = '10px';
                label.style.maxWidth = node.name.length >= 8 ? '58px' : '60px';

                legendItem.appendChild(colorBox);
                legendItem.appendChild(label);
                legendContainer.appendChild(legendItem);

                const serviceNode = serviceNodeLookup[node.id];

                const onClickHandler = () => {
                    serviceNode.onClick();

                };

                legendItem.addEventListener('click', onClickHandler);
            });
        }
        createLegend(nodes);


        // ================================================ 


        function optionChart() {
            const buttonItem = document.createElement('div')
            buttonItem.classList.add('button-item')
            container.appendChild(buttonItem)

            const iconGeomatry = document.createElement('div')
            iconGeomatry.classList.add('geomatryItem')
            iconGeomatry.innerHTML = '<img  src="./img/ic_DBservicer.png" alt="iconGeomatry">';
            iconGeomatry.style.paddingLeft = '10px'
            iconGeomatry.style.display = 'flex'
            iconGeomatry.style.alignItems = 'center'
            iconGeomatry.style.gap = '10px'

            const h3Element = document.createElement('h3');
            h3Element.textContent = 'DB 서비스';
            h3Element.style.fontSize = '15px'
            h3Element.style.fontWeight = '400'
            h3Element.style.color = '#C4E4FF'
            iconGeomatry.appendChild(h3Element);
            container.appendChild(iconGeomatry)

            // ================== resetChart ======================= 

            resetChart = document.createElement('div')
            resetChart.classList.add('button-next');
            resetChart.innerHTML = '<img  src="./img/next.svg" alt="resetChart">'
            resetChart.style.width = '20px'
            resetChart.style.height = '20px'
            resetChart.style.padding = '8px'
            resetChart.style.cursor = 'pointer'
            buttonItem.appendChild(resetChart)
            resetChart.addEventListener('click', () => reStart());


            // ======================== iconZoom  ======================== 


            const iconZoom = document.createElement('div')
            iconZoom.classList.add('button-zoom')
            iconZoom.innerHTML = '<img  src="./img/ic_DBservice_zoom.png" alt="zoom-in">';
            iconZoom.style.padding = '6px'
            iconZoom.style.cursor = 'pointer'
            buttonItem.appendChild(iconZoom)

            iconZoom.addEventListener('click', () => {
                isZoomed = !isZoomed;
                if (isZoomed) {
                    _wzm = w * customizeZoom;
                    _hzm = h * customizeZoom;
                    iconZoom.innerHTML = '<img src="./img/ic_DBservice_out.png" alt="zoom-in">'
                    container.style.backgroundColor = "#4C65BF"
                    containerMain.style.boxShadow = "inset 0 0 2px #afaeae"
                    legendMain.style.background = "rgba(201, 201, 201, 0.04)"
                    panelGroup.style.display = "flex"
                    camera.aspect = _wzm / _hzm
                    camera.updateProjectionMatrix()
                    renderer.setSize(_wzm, _hzm, false)
                    renderer.setPixelRatio(window.devicePixelRatio, 2);
                } else {
                    _wzm = w;
                    _hzm = h;
                    iconZoom.innerHTML = '<img src="./img/ic_DBservice_zoom.png" alt="zoom-out">'
                    container.style.backgroundColor = "#32427B"
                    legendMain.style.background = "none"
                    containerMain.style.boxShadow = "none"
                    panelGroup.style.display = "grid"
                    camera.aspect = _wzm / _hzm;
                    camera.updateProjectionMatrix()
                    renderer.setSize(_wzm, _hzm, false) -
                        renderer.setPixelRatio(window.devicePixelRatio, 2);
                    reStart()
                }
            });

        }
        optionChart()


        // ================================================ 


        function addEventListeners() {
            const serviceNodes = nodes.filter(node => node.type === 'service');
            renderer.domElement.addEventListener('click', onDocumentClick);
            renderer.domElement.addEventListener('mousemove', onDocumentMouseMove);

            function onDocumentClick(event) {
                let clickedObject = getObjectFromMouseEvent(event, serviceNodes);
                if (!clickedObject || !raycasterEnabled) return;

                clickedObject.onClick();
            }



            function onDocumentMouseMove(event) {
                if (!raycasterEnabled) return;
                let hoveredObject = getObjectFromMouseEvent(event, serviceNodes);
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
                const rect = renderer.domElement.getBoundingClientRect();
                const mouse = new THREE.Vector2();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                return mouse;
            }

        }
        addEventListeners()



        // ================================================ 


        function controlChange() {
            const changeListener = () => {
                const cameraPosition = camera.position.clone();
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.lookAt(cameraPosition, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
                serviceNodes = nodes.filter(node => node.type === 'service');

                for (let i = 0; i < serviceNodes.length; i++) {
                    const node = serviceNodes[i];
                    node.sphere.quaternion.setFromRotationMatrix(rotationMatrix);

                }
            };

            controls.addEventListener('change', changeListener);
            controlsInitialized = true;

        };

        function animate() {
            requestAnimationFrame(animate);

            if (!isClicked) {
                if (!controlsInitialized) {
                    controlChange();
                }
                controls.autoRotate = true;
                controls.autoRotateSpeed = rotationY;
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