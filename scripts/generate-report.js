const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const { jsPDF } = require('jspdf');
const database = require('../config/database');

class ReportGenerator {
    constructor() {
        this.outputDir = process.env.REPORT_OUTPUT_DIR || './reports';
        this.ensureOutputDir();
    }

    async ensureOutputDir() {
        await fs.ensureDir(this.outputDir);
    }

    async generateJSONReport() {
        try {
            const connectedServers = await database.getAllConnectedServers();
            const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
            
            const report = {
                generatedAt: moment().toISOString(),
                totalServers: connectedServers.length,
                servers: connectedServers.map(server => ({
                    userId: server.userId,
                    serverId: server.serverId,
                    serverName: server.serverName,
                    discordGuild: {
                        id: server.discordGuild?.id,
                        name: server.discordGuild?.name
                    },
                    lastActive: server.lastActive ? moment(server.lastActive).toISOString() : null,
                    status: server.status,
                    daysSinceLastActive: server.lastActive ? 
                        moment().diff(moment(server.lastActive), 'days') : null
                })),
                statistics: {
                    activeServers: connectedServers.filter(s => s.status === 'linked').length,
                    uniqueUsers: [...new Set(connectedServers.map(s => s.userId))].length,
                    uniqueGuilds: [...new Set(connectedServers.map(s => s.discordGuild?.id).filter(Boolean))].length,
                    serversActiveLastWeek: connectedServers.filter(s => 
                        s.lastActive && moment().diff(moment(s.lastActive), 'days') <= 7
                    ).length
                }
            };

            const filename = `pterodactyl-report_${timestamp}.json`;
            const filepath = path.join(this.outputDir, filename);
            
            await fs.writeJson(filepath, report, { spaces: 2 });
            
            console.log(`✅ JSON report generated: ${filepath}`);
            return { success: true, filepath, data: report };
            
        } catch (error) {
            console.error('❌ Failed to generate JSON report:', error);
            return { success: false, error: error.message };
        }
    }

    async generatePDFReport() {
        try {
            const connectedServers = await database.getAllConnectedServers();
            const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
            
            const doc = new jsPDF();
            let yPosition = 20;

            // Title
            doc.setFontSize(20);
            doc.text('Pterodactyl Discord Bot Report', 20, yPosition);
            yPosition += 20;

            // Generation info
            doc.setFontSize(12);
            doc.text(`Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`, 20, yPosition);
            yPosition += 10;
            doc.text(`Total Connected Servers: ${connectedServers.length}`, 20, yPosition);
            yPosition += 20;

            // Statistics
            doc.setFontSize(16);
            doc.text('Statistics', 20, yPosition);
            yPosition += 15;

            doc.setFontSize(12);
            const stats = {
                'Active Servers': connectedServers.filter(s => s.status === 'linked').length,
                'Unique Users': [...new Set(connectedServers.map(s => s.userId))].length,
                'Unique Discord Guilds': [...new Set(connectedServers.map(s => s.discordGuild?.id).filter(Boolean))].length,
                'Active Last Week': connectedServers.filter(s => 
                    s.lastActive && moment().diff(moment(s.lastActive), 'days') <= 7
                ).length
            };

            for (const [key, value] of Object.entries(stats)) {
                doc.text(`${key}: ${value}`, 20, yPosition);
                yPosition += 8;
            }

            yPosition += 10;

            // Server List
            doc.setFontSize(16);
            doc.text('Connected Servers', 20, yPosition);
            yPosition += 15;

            doc.setFontSize(10);
            
            // Table headers
            doc.text('Server ID', 20, yPosition);
            doc.text('Server Name', 70, yPosition);
            doc.text('Discord Guild', 120, yPosition);
            doc.text('Last Active', 170, yPosition);
            yPosition += 8;

            // Draw line under headers
            doc.line(20, yPosition - 2, 200, yPosition - 2);
            yPosition += 5;

            // Server data
            for (const server of connectedServers) {
                if (yPosition > 270) { // New page if needed
                    doc.addPage();
                    yPosition = 20;
                }

                doc.text(server.serverId.substring(0, 8) + '...', 20, yPosition);
                doc.text((server.serverName || 'Unknown').substring(0, 15), 70, yPosition);
                doc.text((server.discordGuild?.name || 'Unknown').substring(0, 15), 120, yPosition);
                doc.text(server.lastActive ? 
                    moment(server.lastActive).format('MM/DD/YY') : 'Never', 170, yPosition);
                yPosition += 8;
            }

            const filename = `pterodactyl-report_${timestamp}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            await fs.writeFile(filepath, doc.output());
            
            console.log(`✅ PDF report generated: ${filepath}`);
            return { success: true, filepath };
            
        } catch (error) {
            console.error('❌ Failed to generate PDF report:', error);
            return { success: false, error: error.message };
        }
    }

    async generateBothReports() {
        const jsonResult = await this.generateJSONReport();
        const pdfResult = await this.generatePDFReport();
        
        return {
            json: jsonResult,
            pdf: pdfResult,
            success: jsonResult.success && pdfResult.success
        };
    }

    async getReportsList() {
        try {
            const files = await fs.readdir(this.outputDir);
            const reports = files
                .filter(file => file.startsWith('pterodactyl-report_'))
                .map(file => {
                    const filepath = path.join(this.outputDir, file);
                    const stats = fs.statSync(filepath);
                    return {
                        filename: file,
                        filepath,
                        size: stats.size,
                        created: stats.birthtime,
                        type: path.extname(file).substring(1).toUpperCase()
                    };
                })
                .sort((a, b) => b.created - a.created);

            return { success: true, reports };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async cleanupOldReports(daysOld = 30) {
        try {
            const files = await fs.readdir(this.outputDir);
            const cutoffDate = moment().subtract(daysOld, 'days');
            let deletedCount = 0;

            for (const file of files) {
                if (file.startsWith('pterodactyl-report_')) {
                    const filepath = path.join(this.outputDir, file);
                    const stats = await fs.stat(filepath);
                    
                    if (moment(stats.birthtime).isBefore(cutoffDate)) {
                        await fs.remove(filepath);
                        deletedCount++;
                        console.log(`🗑️ Deleted old report: ${file}`);
                    }
                }
            }

            return { success: true, deletedCount };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'both';
    
    const generator = new ReportGenerator();
    
    console.log('🔄 Generating Pterodactyl Discord Bot Report...\n');
    
    switch (command.toLowerCase()) {
        case 'json':
            const jsonResult = await generator.generateJSONReport();
            if (jsonResult.success) {
                console.log(`\n📄 JSON Report Summary:`);
                console.log(`Total Servers: ${jsonResult.data.totalServers}`);
                console.log(`Active Servers: ${jsonResult.data.statistics.activeServers}`);
                console.log(`Unique Users: ${jsonResult.data.statistics.uniqueUsers}`);
                console.log(`File: ${jsonResult.filepath}`);
            }
            break;
            
        case 'pdf':
            const pdfResult = await generator.generatePDFReport();
            if (pdfResult.success) {
                console.log(`\n📄 PDF Report generated: ${pdfResult.filepath}`);
            }
            break;
            
        case 'list':
            const listResult = await generator.getReportsList();
            if (listResult.success) {
                console.log(`\n📋 Available Reports (${listResult.reports.length}):`);
                listResult.reports.forEach(report => {
                    console.log(`- ${report.filename} (${report.type}, ${(report.size/1024).toFixed(1)}KB, ${moment(report.created).fromNow()})`);
                });
            }
            break;
            
        case 'cleanup':
            const days = parseInt(args[1]) || 30;
            const cleanupResult = await generator.cleanupOldReports(days);
            if (cleanupResult.success) {
                console.log(`\n🧹 Cleanup completed: ${cleanupResult.deletedCount} old reports deleted`);
            }
            break;
            
        case 'both':
        default:
            const bothResult = await generator.generateBothReports();
            if (bothResult.success) {
                console.log(`\n📄 Reports generated successfully:`);
                console.log(`JSON: ${bothResult.json.filepath}`);
                console.log(`PDF: ${bothResult.pdf.filepath}`);
                
                if (bothResult.json.success) {
                    console.log(`\n📊 Summary:`);
                    console.log(`Total Servers: ${bothResult.json.data.totalServers}`);
                    console.log(`Active Servers: ${bothResult.json.data.statistics.activeServers}`);
                    console.log(`Unique Users: ${bothResult.json.data.statistics.uniqueUsers}`);
                }
            }
            break;
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ReportGenerator;
