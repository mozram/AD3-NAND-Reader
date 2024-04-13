// Script using Protocol SPI.

if(!('Protocol' in this)) throw "Please open the Protocol tool";

Protocol.Mode.text = "SPI" // make sure SPI tab is selected

var logLevel = 0

function dec2Hex( dec ){
    var outputHex = ""
    for(var i=0; i < dec.length; i++) {
        if( ( 0 == ( i % 16 ) ) && ( 0 != i ) ){
            outputHex += "\n"
        }
        outputHex += ( '0000' + dec[i].toString(16).toUpperCase()).slice(-2) + " ";
    }
    return outputHex
}

function readId(){
    Protocol.SPI.Start() // activate select
    Protocol.SPI.Write(8, [0x9F, 0x00]) // send 2 words of 8 bit length
    var id = Protocol.SPI.Read(8, 3) // read 4 words of 16 bit length
    Protocol.SPI.Stop() // deactivate select

    trace("Device ID is \n" + dec2Hex(id))
    return;
}

function readUniqueId(){
    var currentOpt = getFeature( 0xB0 )
    var newOpt = currentOpt | ( 1 << 6 )  // Enable IDR_E
    setFeature( 0xB0, newOpt )
    readCellArray( 0, 0 )
    readBuffer( [ 0x00, 0x00, 0x00 ], 16 )
    readBufferX2( [ 0x00, 0x00, 0x00 ], 16 )
    readBufferX4( [ 0x00, 0x00, 0x00 ], 16 )
    setFeature( 0xB0, currentOpt )
}

function setFeature( addr, featureOpt ){
    var cmd = [ 0x1F, addr, featureOpt ]
    Protocol.SPI.Start() // activate select
    Protocol.SPI.Write(8, cmd) // send 2 words of 8 bit length
    Protocol.SPI.Stop() // deactivate select

    trace("Set feature: " + dec2Hex(cmd))
}

function getFeature( addr ){
    var cmd = [ 0x0F, addr ]
    Protocol.SPI.Start() // activate select
    Protocol.SPI.Write(8, cmd) // send 2 words of 8 bit length
    var data = Protocol.SPI.Read(8, 1)
    Protocol.SPI.Stop() // deactivate select
    trace("Get feature: " + dec2Hex(cmd))
    trace("Get feature output:\n" + dec2Hex(data))
    
    return data[0]  // For some reason output is in array. Trying to concatenate this result in weird array
}

function generateRowAddr( block, page ){
    // First 6 bits is dummy, next 12 bits is block number, next 6 bits is page number of said row
    const blockMask = 0x3FFC0
    const byteMask = 0xFF
    var rowAddr = 0x00000000
    // Set block addr
    blockTemp = ( block << 6 ) & blockMask
    rowAddr = rowAddr | blockTemp
    // Set page addr
    rowAddr = rowAddr | page

    // Convert to array
    var addr = [ 0x00, 0x00, 0x00 ]
    addr[0] = ( rowAddr >> 16 ) & byteMask
    addr[1] = ( rowAddr >> 8 ) & byteMask
    addr[2] = rowAddr & byteMask

    return addr
}

// Instruct NAND to read page area
function readCellArray( block, page ){
    var addr = generateRowAddr( block, page )
    var cmd = [ 0x13 ]
    var cmdArray = cmd.concat(addr)

    // Read cell array command
    Protocol.SPI.Start() // activate select
    Protocol.SPI.Write(8, cmdArray) // send 2 words of 8 bit length
    Protocol.SPI.Stop() // deactivate select
    trace("Read cell array: " + dec2Hex(cmdArray))

    // Read status for OIP, ECCS0 and ECCS1 bit. Keep read until OIP bit is clear
    do {
        status = getFeature( 0xC0 )
    }
    while ( 0x1 == ( status & 0x1 ) )  // Check OIP status
    
    return cmdArray  // Return the addr array for later use
}

function readBuffer( addr24bits, length ){
    var cmd = [ 0x03, addr24bits[0], addr24bits[1], addr24bits[2] ]  // last byte is dummy
    Protocol.SPI.Start() // activate select
    Protocol.SPI.Write(8, cmd) // send 2 words of 8 bit length
    var data = Protocol.SPI.Read(8, length)
    Protocol.SPI.Stop() // deactivate select
    trace("Read buffer: " + dec2Hex(cmd))
    trace("Read buffer output:\n" + dec2Hex(data))
    return data
}

// still broken
function readBufferX2( addr24bits, length ){
    var cmd = [ 0x3B, addr24bits[0], addr24bits[1], addr24bits[2] ]  // last byte is dummy
    Protocol.SPI.Start() // activate select
    Protocol.SPI.Write(8, cmd) // send 2 words of 8 bit length
    var data = Protocol.SPI.ReadDual(8, length)
    Protocol.SPI.Stop() // deactivate select
    trace("Read buffer X2: " + dec2Hex(cmd))
    trace("Read buffer X2 output:\n" + dec2Hex(data))
}

// still brokenlength
function readBufferX4( addr24bits, length ){
    var cmd = [ 0x6B, addr24bits[0], addr24bits[1], addr24bits[2] ]  // last byte is dummy
    Protocol.SPI.Start() // activate select
    Protocol.SPI.Write(8, cmd) // send 2 words of 8 bit length
    var data = Protocol.SPI.ReadQuad(8, length)
    Protocol.SPI.Stop() // deactivate select
    trace("Read buffer X4: " + dec2Hex(cmd))
    trace("Read buffer X4 output:\n" + dec2Hex(data))
}

function readPage( block, page, length ){
    trace( "Reading block and page: " + block + ":" + page ) 
    // Read cell array
    addr = readCellArray( block, page )
    // Read buffer
    readBufferX4( addr, length )
}

function readData( block, page, addr, length ){
    trace( "Reading block and page: " + block + ":" + page ) 
    // Read cell array
    addr = readCellArray( block, page )
    // Read buffer
    readBuffer( addr, 4352 )
}

function scan4BadBlock(){
    // Suppress other log
    logLevel = 1
    for(var i=0; i < 4096; i++) {
        addr = readCellArray( i, 0 )  // Read only first page each block
        var data = readBuffer( addr, 1 )
        if( 0xFF != data ){
            print("Bad block at block: " + i)
        }
    }
}

function trace( data ){
    if( 0 == logLevel ){
        print(data)
    }
}

function readParameter(){
    var currentOpt = getFeature( 0xB0 )
    var newOpt = currentOpt | ( 1 << 6 )  // Enable IDR_E
    setFeature( 0xB0, newOpt )
    readCellArray( 0, 1 )  // Read parameter page
    readBuffer( [ 0x00, 0x00, 0x00 ], 256 )
    readBufferX2( [ 0x00, 0x00, 0x00 ], 256 )
    readBufferX4( [ 0x00, 0x00, 0x00 ], 256 )
    setFeature( 0xB0, currentOpt )
}

//setFeature( 0xB0, 0x13 )
readId()
readUniqueId()
//readPage( 185, 0, 4224 )
//scan4BadBlock()
//getFeature( 0xB0 )
readParameter()