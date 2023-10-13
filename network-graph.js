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



    const animate = () => {
        requestAnimationFrame(animate);


        // renderer.setClearColor(0xffffff, 1.0);

        scene.rotation.y += 0.004;
        controls.update();


        renderer.render(scene, camera);
    };

    animate();


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
            const theta = 2 * Math.PI * (index / numServices);
            const x = serviceRadius * Math.cos(theta);
            const y = 0;
            const z = serviceRadius * Math.sin(theta);


            const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 18);
            geometry.rotateX(Math.PI / 2);


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


            sphere.position.set(x, y, z);
            node.sphere = sphere;
            scene.add(sphere);
        });






        // ==============================================================


        const tableNodes = nodes.filter(node => node.type === 'table');

        tableNodes.forEach((node, index) => {
            const theta = 2 * Math.PI * (index / tableNodes.length);
            const x = 0;
            const y = tableRadius * Math.cos(theta);
            const z = tableRadius * Math.sin(theta);

            const geometry = new THREE.SphereGeometry(0.2, 18, 12);
            const material = new THREE.MeshBasicMaterial({ color: colors(node.id) });
            const sphere = new THREE.Mesh(geometry, material);

            sphere.position.set(x, y, z);
            node.sphere = sphere;
            scene.add(sphere);


            const label = createLabel(node.name.toUpperCase());
            label.position.set(x, y + 0.5, z);
            scene.add(label);
        });

        // ==============================================================

        links.forEach(link => {
            const sourceNode = nodes.find(n => n.id === link.source);
            const targetNode = nodes.find(n => n.id === link.target);

            if (sourceNode.type === 'service' && targetNode.type === 'table') {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(sourceNode.sphere.position.x, sourceNode.sphere.position.y, sourceNode.sphere.position.z),
                    new THREE.Vector3(targetNode.sphere.position.x, targetNode.sphere.position.y, targetNode.sphere.position.z)
                ]);

                const material = new THREE.LineBasicMaterial({ color: new THREE.Color(colors(sourceNode.id)) });
                const line = new THREE.Line(geometry, material);

                scene.add(line);
            }
        });
    };

    const { nodes, links } = extractNodesAndLinks(data);
    createVisualNodesAndLinks(nodes, links)



    // ==============================================================



    function createLabel(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = 'bold 14px Roboto';
        const width = context.measureText(text).width;

        canvas.width = width;
        canvas.height = 20;

        context.font = 'bold 14px Roboto';
        context.fillStyle = '#A6F6FF';
        context.fillText(text, 0, 12);

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({ map: texture });
        const label = new THREE.Sprite(material);

        label.rotation.x = Math.PI / 2;

        label.scale.set(1, 0.5, 1);
        return label;
    };
});