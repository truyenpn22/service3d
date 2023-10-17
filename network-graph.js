import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/controls/OrbitControls.js';

d3.json("data.json").then(function (data) {

    // ==============================================================

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 12;


    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: document.createElement("canvas")
    });


    const controls = new OrbitControls(camera, renderer.domElement);
    document.getElementById("canvas-container").appendChild(renderer.domElement);
    renderer.setSize(window.innerWidth, window.innerHeight);


    // ==============================================================


    const colors = d3.scaleOrdinal(d3.schemeCategory10);


    // ==============================================================


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


        const serviceRadius = 5;
        const tableRadius = 5;


        const serviceNodes = nodes.filter(node => node.type === 'service');
        const numServices = serviceNodes.length;

        serviceNodes.forEach((node, index) => {
            const theta = (index / numServices) * Math.PI * 2;
            const x = 0;
            const y = serviceRadius * Math.cos(theta);
            const z = serviceRadius * Math.sin(theta);


            const geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 18);
            geometry.rotateX(Math.PI / 2);


            // =================== Text service ======================

            const labelCanvas = document.createElement('canvas');
            const labelContext = labelCanvas.getContext('2d');


            const text = node.name.toUpperCase();
            const textWidth = labelContext.measureText(text).width;

            labelCanvas.width = textWidth * 1.2;
            labelCanvas.height = textWidth * 1.6;

            labelContext.fillStyle = colors(node.id);

            labelContext.save();
            labelContext.translate(labelCanvas.width / 2, labelCanvas.height / 2);
            labelContext.rotate(-Math.PI / 2);
            labelContext.fillStyle = colors(node.id);
            labelContext.font = 'bold 14px Roboto';
            labelContext.fillText(text, -textWidth / 2, 6);
            labelContext.restore();

            const texture = new THREE.CanvasTexture(labelCanvas);


            const material = new THREE.MeshBasicMaterial({ map: texture });
            const sphere = new THREE.Mesh(geometry, material);


            // ====================== Click servicenode ========================


            sphere.onClick = function () {

                // Clear existing shadows and connected lines from other service nodes
                serviceNodes.forEach((otherNode) => {
                    if (otherNode.sphere !== this) {
                        const otherShadowMesh = otherNode.sphere.userData.shadowMesh;
                        if (otherShadowMesh) {
                            scene.remove(otherShadowMesh);
                            otherNode.sphere.userData.shadowMesh = null;
                            otherNode.sphere.userData.connectedLines.forEach((line) => {
                                scene.remove(line);
                            });
                            otherNode.sphere.userData.connectedLines = [];
                        }
                    }
                    // Check if the node is connected to a table and remove its shadowMesh
                    links.forEach((link) => {
                        if (link.source === otherNode.id) {
                            const targetNode = nodes.find(n => n.id === link.target);
                            if (targetNode && targetNode.type === 'table' && targetNode.sphere.userData.shadowMesh) {
                                scene.remove(targetNode.sphere.userData.shadowMesh);
                                targetNode.sphere.userData.shadowMesh = null;
                            }
                        }
                    });
                });


                // =================== Shadow Tablesnode =====================


                this.userData.isSelected = !this.userData.isSelected;

                if (this.userData.isSelected) {
                    if (!this.userData.shadowMesh) {
                        const shadowGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 18);
                        shadowGeometry.rotateX(Math.PI / 2);

                        const shadowMaterial = new THREE.MeshBasicMaterial({
                            color: colors(node.id),
                            transparent: true,
                            opacity: 0.5,
                        });

                        const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
                        scene.add(shadowMesh);
                        this.userData.shadowMesh = shadowMesh;
                    }

                    this.userData.connectedLines = [];


                    // ========================= Connection path =============================


                    links.forEach((link) => {
                        if (link.source === node.id) {
                            const targetNode = nodes.find(n => n.id === link.target);

                            if (targetNode && targetNode.type === 'table') {
                                const targetPosition = targetNode.sphere.position;
                                const distance = this.position.distanceTo(targetPosition);
                                const geometry = new THREE.CylinderGeometry(0.02, 0.02, distance, 18);
                                const material = new THREE.MeshBasicMaterial({
                                    color: new THREE.Color(colors(node.id)),
                                });
                                const line = new THREE.Mesh(geometry, material);

                                const direction = new THREE.Vector3().subVectors(targetPosition, this.position);
                                const midpoint = new THREE.Vector3().addVectors(this.position, direction.multiplyScalar(0.5));
                                line.position.copy(midpoint);

                                const axis = new THREE.Vector3(0, 1, 0);
                                line.quaternion.setFromUnitVectors(axis, direction.clone().normalize());
                                scene.add(line);

                                this.userData.connectedLines.push(line);


                                // =================== Shadow Tablesnode =====================


                                const shadowGeometry = new THREE.SphereGeometry(0.26, 18, 12);
                                shadowGeometry.rotateX(Math.PI / 2);

                                const shadowMaterial = new THREE.MeshBasicMaterial({
                                    color: colors(targetNode.id),
                                    transparent: true,
                                    opacity: 0.5,
                                });

                                const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
                                shadowMesh.position.copy(targetPosition);
                                scene.add(shadowMesh);

                                targetNode.sphere.userData.shadowMesh = shadowMesh;

                            }
                        }
                    });
                } else {

                    const shadowMesh = this.userData.shadowMesh;

                    // =========== Remove shadowMesh service ===========
                    if (shadowMesh) {
                        scene.remove(shadowMesh);
                        this.userData.shadowMesh = null;
                    }

                    // =========== Remove line ===========

                    this.userData.connectedLines.forEach(line => scene.remove(line));

                    // =========== Remove shadowMesh tables ===========

                    links.forEach((link) => {
                        if (link.source === node.id) {
                            const targetNode = nodes.find(n => n.id === link.target);
                            if (targetNode && targetNode.type === 'table' && targetNode.sphere.userData.shadowMesh) {
                                scene.remove(targetNode.sphere.userData.shadowMesh);
                                targetNode.sphere.userData.shadowMesh = null;
                            }
                        }
                    });

                }
            };

            sphere.position.set(x, y, z);
            node.sphere = sphere;
            scene.add(sphere);
        });


        renderer.domElement.addEventListener('click', onDocumentClick);
        function onDocumentClick(event) {
            const mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects(serviceNodes.map(node => node.sphere));

            if (intersects.length > 0) {
                intersects[0].object.onClick();
            }
        }





        // ==============================================================


        const tableNodes = nodes.filter(node => node.type === 'table');

        tableNodes.forEach((node, index) => {

            const quadrant = index % 10;

            const theta = (quadrant / 10) * Math.PI * 2;
            const x = tableRadius * Math.cos(theta);
            const y = 0;
            const z = tableRadius * Math.sin(theta);

            const geometry = new THREE.SphereGeometry(0.2, 18, 12);
            const material = new THREE.MeshBasicMaterial({ color: colors(node.id) });
            const sphere = new THREE.Mesh(geometry, material);

            sphere.position.set(x, y, z);
            node.sphere = sphere;
            scene.add(sphere);

            // ============ Text tables ==============

            const countLabel = createLabel(node.count);
            countLabel.position.set(x, y + 0.7, z);
            scene.add(countLabel);

            const label = createLabel(node.name.toUpperCase(), "bold 20px Roboto", colors(node.id));
            label.position.set(x, y + 0.3, z);
            scene.add(label);
        });



        // ==============================================================



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

                scene.add(line);
            }
        });

    };

    const { nodes, links } = extractNodesAndLinks(data);
    createVisualNodesAndLinks(nodes, links)

    // ==============================================================

    function createLabel(text, fontText, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = fontText || 'bold 14px Roboto';
        const width = context.measureText(text).width;

        canvas.width = width + 10;
        canvas.height = 30;

        context.font = fontText || 'bold 14px Roboto';
        context.fillStyle = color || "white";
        context.fillText(text, 0, 15);

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({ map: texture });
        const label = new THREE.Sprite(material);

        label.rotation.x = Math.PI / 2;

        label.scale.set(1, 0.5, 1);
        return label;
    };

    // ================================================================

    let serviceNodes;
    const animate = () => {
        requestAnimationFrame(animate);

        // renderer.setClearColor(0xffffff, 1.0);

        scene.rotation.y += 0.004;

        serviceNodes = nodes.filter(node => node.type === 'service');


        serviceNodes.forEach((node, index) => {
            node.sphere.rotation.y -= 0.004;

            if (node.sphere.userData.isSelected && node.sphere.userData.shadowMesh) {
                const shadowMesh = node.sphere.userData.shadowMesh;
                shadowMesh.position.copy(node.sphere.position);
                shadowMesh.rotation.copy(node.sphere.rotation);
            }
        });

        controls.update();

        renderer.render(scene, camera);
    };

    animate();

});

