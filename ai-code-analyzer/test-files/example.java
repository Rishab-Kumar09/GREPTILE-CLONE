package com.example.banking;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;

public class TransactionProcessor {
    private Connection conn;
    private List<Transaction> transactions;

    public void processTransactions() {
        try {
            // MEMORY LEAK: Connection never closed
            conn = DriverManager.getConnection("jdbc:mysql://localhost/bank");
            
            for (Transaction tx : transactions) {
                // SECURITY ISSUE: SQL Injection
                Statement stmt = conn.createStatement();
                stmt.executeUpdate("UPDATE accounts SET balance = balance + " + tx.getAmount() + 
                                 " WHERE id = '" + tx.getAccountId() + "'");
                
                // CRASH RISK: Statement not closed
                
                // LOGIC ERROR: No rollback on failure
                if (tx.getAmount() < 0) {
                    // Check balance after withdrawal
                    double newBalance = getBalance(tx.getAccountId());
                    if (newBalance < 0) {
                        // Should rollback but doesn't
                        continue;
                    }
                }
            }
        } catch (Exception e) {
            // DATA LOSS: Silent failure
            System.out.println("Error occurred");
        }
    }

    private double getBalance(String accountId) {
        // CRASH RISK: Null pointer possible
        return transactions.stream()
            .filter(t -> t.getAccountId().equals(accountId))
            .mapToDouble(Transaction::getAmount)
            .sum();
    }
}
