#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <map>
#include <sstream>
#include <iomanip>
#include <cstdint>

struct Instruction {
    int opcode;
    bool requires_operand;
};

std::map<std::string, Instruction> opcodes = {
    {"ldc", {0, true}}, {"adc", {1, true}}, {"ldl", {2, true}}, {"stl", {3, true}},
    {"ldnl", {4, true}}, {"stnl", {5, true}}, {"add", {6, false}}, {"sub", {7, false}},
    {"shl", {8, false}}, {"shr", {9, false}}, {"adj", {10, true}}, {"a2sp", {11, false}},
    {"sp2a", {12, false}}, {"call", {13, true}}, {"return", {14, false}}, {"brz", {15, true}},
    {"brlz", {16, true}}, {"br", {17, true}}, {"HALT", {18, false}}
};

std::map<std::string, int> symbol_table;

std::string cleanLine(std::string line) {
    size_t comment_pos = line.find(';');
    if (comment_pos != std::string::npos) line = line.substr(0, comment_pos); 
    line.erase(0, line.find_first_not_of(" \t\r\n"));
    line.erase(line.find_last_not_of(" \t\r\n") + 1);
    return line;
}

// Pass 1 now accepts a log stream to write errors directly to the file
bool runPassOne(const std::vector<std::string>& lines, std::ostream& log_out) {
    int pc = 0;
    for (size_t i = 0; i < lines.size(); ++i) {
        std::string current_line = lines[i];
        if (current_line.empty()) continue;

        size_t colon_pos = current_line.find(':');
        std::string label = "";
        
        if (colon_pos != std::string::npos) {
            label = current_line.substr(0, colon_pos);
            label.erase(label.find_last_not_of(" \t") + 1);
            
            if (symbol_table.count(label)) {
                log_out << "Error at line " << i + 1 << ": Duplicate label definition '" << label << "'\n";
                std::cerr << "Error: Duplicate label '" << label << "'\n";
                return false; 
            }
            current_line = current_line.substr(colon_pos + 1);
            current_line.erase(0, current_line.find_first_not_of(" \t"));
        }

        if (!current_line.empty()) {
            std::stringstream ss(current_line);
            std::string mnemonic;
            ss >> mnemonic;
            
            if (mnemonic == "SET") {
                std::string val_str;
                if (ss >> val_str) {
                    symbol_table[label] = std::stoi(val_str, nullptr, 0);
                } else {
                    log_out << "Error at line " << i + 1 << ": SET missing operand\n";
                    std::cerr << "Error: SET missing operand\n";
                    return false;
                }
            } else {
                if (!label.empty()) symbol_table[label] = pc;
                pc++;
            }
        } else if (!label.empty()) {
            symbol_table[label] = pc;
        }
    }
    return true;
}

// Pass 2 also accepts the log stream
bool runPassTwo(const std::vector<std::string>& lines, const std::string& base_name, std::ostream& log_out) {
    std::ofstream bin_out(base_name + ".obj", std::ios::binary);
    std::ofstream lst_out(base_name + ".lst");
    
    if (!bin_out.is_open() || !lst_out.is_open()) return false;

    int pc = 0;
    for (size_t i = 0; i < lines.size(); ++i) {
        std::string current_line = lines[i];
        if (current_line.empty()) continue;

        size_t colon_pos = current_line.find(':');
        if (colon_pos != std::string::npos) {
            std::string label = current_line.substr(0, colon_pos);
            lst_out << std::hex << std::setw(8) << std::setfill('0') << pc << "         " << label << ":" << std::endl;
            current_line = current_line.substr(colon_pos + 1);
            current_line.erase(0, current_line.find_first_not_of(" \t"));
        }

        if (current_line.empty()) continue;

        std::stringstream ss(current_line);
        std::string mnemonic, operand_str;
        ss >> mnemonic;

        if (mnemonic == "SET") continue;

        uint32_t machine_code = 0;

        if (mnemonic == "data") {
            if (!(ss >> operand_str)) {
                log_out << "Error: 'data' missing operand at line " << i + 1 << "\n";
                return false;
            }
            machine_code = std::stoi(operand_str, nullptr, 0);
        } 
        else if (opcodes.count(mnemonic)) {
            Instruction instr = opcodes[mnemonic];
            int32_t operand_val = 0;

            if (instr.requires_operand) {
                if (!(ss >> operand_str)) {
                    log_out << "Error: Missing operand for " << mnemonic << " at line " << i + 1 << "\n";
                    return false;
                }

                if (symbol_table.count(operand_str)) {
                    if (mnemonic == "br" || mnemonic == "brz" || mnemonic == "brlz" || mnemonic == "call") {
                        operand_val = symbol_table[operand_str] - (pc + 1);
                    } else {
                        operand_val = symbol_table[operand_str];
                    }
                } else {
                    try {
                        operand_val = std::stoi(operand_str, nullptr, 0); 
                    } catch (...) {
                        log_out << "Error: Invalid operand '" << operand_str << "' at line " << i+1 << "\n";
                        return false;
                    }
                }
            } else {
                if (ss >> operand_str) {
                    log_out << "Error: Unexpected operand for " << mnemonic << " at line " << i + 1 << "\n";
                    return false;
                }
            }
            machine_code = ((operand_val & 0xFFFFFF) << 8) | (instr.opcode & 0xFF);
        } else {
            log_out << "Error: Unknown mnemonic '" << mnemonic << "' at line " << i + 1 << "\n";
            return false;
        }

        bin_out.write(reinterpret_cast<const char*>(&machine_code), sizeof(machine_code));
        lst_out << std::hex << std::setw(8) << std::setfill('0') << pc << " " 
                << std::setw(8) << std::setfill('0') << machine_code << " " 
                << mnemonic << " " << operand_str << std::endl;
        pc++;
    }
    return true;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <source.asm>" << std::endl;
        return 1;
    }

    std::string filename = argv[1];
    std::string base_name = filename.substr(0, filename.find_last_of('.'));
    
    // Automatically create the log file
    std::ofstream log_out(base_name + "_asm.log");

    std::ifstream infile(filename);
    if (!infile.is_open()) {
        std::cerr << "Error: Could not open file " << filename << std::endl;
        return 1;
    }

    std::vector<std::string> lines;
    std::string line;
    while (std::getline(infile, line)) {
        lines.push_back(cleanLine(line));
    }
    infile.close();

    log_out << "--- Assembler Log for " << filename << " ---\n";

    if (!runPassOne(lines, log_out)) {
        log_out << "Assembly failed during Pass 1.\n";
        return 1;
    }

    if (!runPassTwo(lines, base_name, log_out)) {
        log_out << "Assembly failed during Pass 2.\n";
        return 1;
    }

    std::cout << "Assembly successful. Generated .obj, .lst, and .log files." << std::endl;
    log_out << "Assembly completed successfully.\n";
    return 0;
}